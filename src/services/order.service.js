const {Op}=require("sequelize");
const {Order,OrderItem,Cart,CartItem,ProductVariant,Product,Address,User,sequelize}=require("../../models");
const AppError=require("../util/app-error");
const {paginate}=require("../util/paginate");

const SHIPPING_FEE=Number(process.env.SHIPPING_FEE || 0);

// Option A: Tiered shipping calculation
// - Subtotal $0: $0.00
// - Subtotal < $20: $2.50 (balanced rate for low-order purchases)
// - Subtotal $20 - $74.99: $5.00 (standard rate)
// - Subtotal >= $75: $0.00 (FREE shipping)
const calculateTieredShipping=(subtotal)=>{
    const s=Number(subtotal) || 0;
    if(s<=0) return 0;
    if(s>=75) return 0;
    if(s<20) return 2.50;
    return 5.00;
};

const money=(n)=>+Number(n || 0).toFixed(2);

const parseNonNegativeMoney=(val,fieldName)=>{
    if(val===undefined || val===null || val==="") return undefined;
    const num=Number(val);
    if(Number.isNaN(num) || num<0){
        throw new AppError(400,`${fieldName} must be a non-negative number`);
    }
    return money(num);
};

const normalizeOrderStatus=(raw)=>{
    const s=String(raw || "pending").trim().toLowerCase();
    if(s==="processing") return "pending";
    if(s==="completed" || s==="complete") return "delivered";
    if(s==="succeeded" || s==="success") return "paid";
    if(s==="canceled") return "cancelled";
    return Order.STATUSES.includes(s) ? s : "pending";
};

// e.g. ORD-20261016-4F7K2Q
const generateOrderNumber=()=>{
    const d=new Date();
    const date=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
    const rand=Math.random().toString(36).slice(2,8).toUpperCase();
    return `ORD-${date}-${rand}`;
};

const orderInclude=[{model:OrderItem,as:"items"}];

const findOrder=async(where,transaction,lock)=>{
    const order=await Order.findOne({
        where,
        include:orderInclude,
        transaction,
        lock:lock ? {level:lock,of:Order} : undefined
    });
    if(!order) throw new AppError(404,"Order not found");
    return order;
};

// pick address: the given addressId, or user's default one, or fallback/auto-create default address
const resolveAddress=async(userId,addressId,transaction,fallbackBody={})=>{
    let address=null;
    if(addressId){
        address=await Address.findOne({where:{id:addressId},transaction});
    }
    if(!address){
        address=await Address.findOne({where:{userId,status:true},transaction});
    }
    if(!address){
        address=await Address.findOne({where:{userId},order:[["id","ASC"]],transaction});
    }
    if(!address){
        const user=await User.findByPk(userId,{transaction});
        const receiverName=fallbackBody.shipping_receiver_name ||
            (user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "") ||
            "Walk-in / Admin Customer";
        address=await Address.create({
            userId,
            receiver_name:receiverName,
            phone:fallbackBody.shipping_phone || "012345678",
            street:fallbackBody.shipping_street || "Store Counter / POS",
            city:fallbackBody.shipping_city || "Phnom Penh",
            status:true
        },{transaction});
    }
    return address;
};

// put stock back for every item (used on cancel)
const restoreStock=async(order,transaction)=>{
    for(const item of (order.items || [])){
        if(!item.variantId) continue;
        await ProductVariant.increment({stock_qty:item.quantity},{where:{id:item.variantId},transaction});
    }
};

// recalculate order sub_total and total from its OrderItems
const recalculateOrderTotals=async(orderId,transaction)=>{
    const order=await Order.findByPk(orderId,{transaction});
    if(!order) return null;
    const items=await OrderItem.findAll({where:{orderId:order.id},transaction});
    const subTotal=money(items.reduce((sum,it)=>sum+Number(it.amount || 0),0));
    const discount=money(order.discount || 0);
    const shippingFee=money(order.shipping_fee || 0);
    order.sub_total=subTotal;
    order.total=money(Math.max(0,subTotal-discount+shippingFee));
    await order.save({transaction});
    return order;
};

// POST /order: turn my cart into an order (also supports direct items[] or sub_total when cart is empty)
const checkout=async(userId,body={})=>sequelize.transaction(async(t)=>{
    const cart=await Cart.findOne({where:{userId},transaction:t});
    const cartItems=cart ? await CartItem.findAll({where:{cartId:cart.id},transaction:t}) : [];
    const directItems=Array.isArray(body.items) ? body.items.filter(i=>i && i.variantId) : [];
    const hasDirectSubTotal=body.sub_total!==undefined && body.sub_total!==null && body.sub_total!=="";

    if(!cartItems.length && !directItems.length && !hasDirectSubTotal){
        throw new AppError(
            400,
            "Cart is empty. Add items via POST /cart/items first, pass sub_total or items in POST /order, or use POST /order/admin."
        );
    }

    const address=await resolveAddress(userId,body.addressId,t,body);

    const sourceItems=cartItems.length ? cartItems : directItems;
    let sub_total=0;
    let lines=[];

    if(sourceItems.length){
        // lock variants so two checkouts can't oversell the same stock
        const variants=await ProductVariant.findAll({
            where:{id:sourceItems.map(i=>i.variantId)},
            include:[{model:Product,as:"product",attributes:["id","name","base_price"]}],
            lock:{level:t.LOCK.UPDATE,of:ProductVariant},
            transaction:t
        });
        const byId=new Map(variants.map(v=>[v.id,v]));

        lines=sourceItems.map(ci=>{
            const qty=Math.max(1,parseInt(ci.quantity ?? 1,10) || 1);
            const v=byId.get(Number(ci.variantId));
            if(!v || !v.is_active) throw new AppError(400,`Variant ${ci.variantId} is no longer available`);
            if(qty>v.stock_qty) throw new AppError(400,`Only ${v.stock_qty} left in stock for ${v.sku}`);
            const unit_price=money(v.price!==null ? v.price : v.product.base_price);
            const amount=money(unit_price*qty);
            sub_total+=amount;
            return {
                variant:v,
                data:{
                    variantId:v.id,
                    product_name:v.product.name,
                    sku:v.sku,
                    color:v.color,
                    size:v.size,
                    unit_price,
                    quantity:qty,
                    amount
                }
            };
        });
        sub_total=money(sub_total);
    }
    else{
        sub_total=parseNonNegativeMoney(body.sub_total,"sub_total") ?? 0;
    }

    const rawDiscount=parseNonNegativeMoney(body.discount,"discount");
    const discount=rawDiscount!==undefined
        ? (sub_total>0 ? money(Math.min(sub_total,rawDiscount)) : rawDiscount)
        : 0;
    const rawShipping=parseNonNegativeMoney(
        body.shipping_fee!==undefined ? body.shipping_fee : body.shipping,
        "shipping_fee"
    );
    const shipping_fee=rawShipping!==undefined
        ? rawShipping
        : (process.env.SHIPPING_FEE !== undefined ? money(SHIPPING_FEE) : calculateTieredShipping(sub_total));
    const total=money(Math.max(0,sub_total-discount+shipping_fee));

    const order=await Order.create({
        userId,
        addressId:address.id,
        order_number:generateOrderNumber(),
        shipping_receiver_name:body.shipping_receiver_name || address.receiver_name,
        shipping_phone:body.shipping_phone || address.phone,
        shipping_street:body.shipping_street || address.street,
        shipping_city:body.shipping_city || address.city,
        sub_total,
        discount,
        shipping_fee,
        total,
        status:"pending"
    },{transaction:t});

    if(lines.length){
        await OrderItem.bulkCreate(lines.map(l=>({...l.data,orderId:order.id})),{transaction:t});

        // reduce stock
        for(const l of lines){
            await l.variant.decrement({stock_qty:l.data.quantity},{transaction:t});
        }
    }

    // empty the cart if order came from cart
    if(cart && cartItems.length){
        await CartItem.destroy({where:{cartId:cart.id},transaction:t});
    }

    return findOrder({id:order.id},t);
});

// shared filters: status, q (order_number), from / to (createdAt, YYYY-MM-DD)
const buildOrderWhere=(query)=>{
    const where={};
    if(query.status){
        const norm=normalizeOrderStatus(query.status);
        where.status=norm;
    }
    if(query.q) where.order_number={[Op.iLike]:`%${query.q}%`};
    if(query.from || query.to){
        const range={};
        if(query.from){
            if(isNaN(Date.parse(query.from))) throw new AppError(400,"from must be a valid date (YYYY-MM-DD)");
            range[Op.gte]=new Date(query.from);
        }
        if(query.to){
            if(isNaN(Date.parse(query.to))) throw new AppError(400,"to must be a valid date (YYYY-MM-DD)");
            const end=new Date(query.to);
            end.setHours(23,59,59,999);
            range[Op.lte]=end;
        }
        where.createdAt=range;
    }
    return where;
};

// GET /order (mine, newest first)
const listMine=async(userId,query={})=>paginate(Order,{
    where:{...buildOrderWhere(query),userId},
    include:orderInclude,
    order:[["createdAt","DESC"]]
},query);

// GET /order/:id (mine)
const getMine=async(userId,id)=>findOrder({id,userId});

// PATCH /order/:id/cancel (mine, only while pending)
const cancelMine=async(userId,id)=>sequelize.transaction(async(t)=>{
    const order=await findOrder({id,userId},t,t.LOCK.UPDATE);
    if(order.status!=="pending") throw new AppError(400,`Cannot cancel an order that is ${order.status}`);
    await restoreStock(order,t);
    order.status="cancelled";
    await order.save({transaction:t});
    return order;
});

// ---------- admin ----------

// GET /order/admin?status=&q=&userId=&from=&to=&page=&limit=
const listAll=async(query)=>{
    const where=buildOrderWhere(query);
    if(query.userId) where.userId=query.userId;
    return paginate(Order,{
        where,
        include:[...orderInclude,{model:User,as:"user",attributes:["id","firstName","lastName","email"]}],
        order:[["createdAt","DESC"]]
    },query);
};

// GET /order/admin/:id
const getAny=async(id)=>{
    const order=await Order.findOne({
        where:{id},
        include:[...orderInclude,{model:User,as:"user",attributes:["id","firstName","lastName","email"]}]
    });
    if(!order) throw new AppError(404,"Order not found");
    return order;
};

// POST /order/admin: create an order directly (supports discount, shipping_fee/shipping, and optional items)
const createAdminOrder=async(adminUser,body={})=>sequelize.transaction(async(t)=>{
    let targetUserId=adminUser.id;
    if(body.userId){
        const u=await User.findByPk(body.userId,{transaction:t});
        if(u) targetUserId=u.id;
    }

    const address=await resolveAddress(targetUserId,body.addressId,t,body);
    let sub_total=parseNonNegativeMoney(body.sub_total,"sub_total") ?? 0;
    const discount=parseNonNegativeMoney(body.discount,"discount") ?? 0;
    const rawShipping=parseNonNegativeMoney(
        body.shipping_fee!==undefined ? body.shipping_fee : body.shipping,
        "shipping_fee"
    );
    const shipping_fee=rawShipping!==undefined
        ? rawShipping
        : (process.env.SHIPPING_FEE !== undefined ? money(SHIPPING_FEE) : calculateTieredShipping(sub_total));
    const explicitTotal=parseNonNegativeMoney(body.total,"total");

    if(sub_total===0 && explicitTotal!==undefined && explicitTotal>0 && !Array.isArray(body.items)){
        sub_total=explicitTotal;
    }

    const total=(sub_total>0 || discount>0 || shipping_fee>0)
        ? money(Math.max(0,sub_total-discount+shipping_fee))
        : (explicitTotal ?? 0);

    const status=normalizeOrderStatus(body.status || "pending");
    const order_number=body.order_number && String(body.order_number).trim()
        ? String(body.order_number).trim()
        : generateOrderNumber();

    const order=await Order.create({
        userId:targetUserId,
        addressId:address.id,
        order_number,
        shipping_receiver_name:body.shipping_receiver_name || address.receiver_name,
        shipping_phone:body.shipping_phone || address.phone,
        shipping_street:body.shipping_street || address.street,
        shipping_city:body.shipping_city || address.city,
        sub_total,
        discount,
        shipping_fee,
        total,
        status
    },{transaction:t});

    if(Array.isArray(body.items) && body.items.length>0){
        for(const rawItem of body.items){
            let variant=null;
            if(rawItem.variantId){
                variant=await ProductVariant.findByPk(rawItem.variantId,{
                    include:[{model:Product,as:"product",attributes:["id","name","base_price"]}],
                    transaction:t
                });
            }
            const quantity=Math.max(1,parseInt(rawItem.quantity ?? 1,10) || 1);
            const unit_price=money(
                rawItem.unit_price!==undefined && Number(rawItem.unit_price)>=0
                    ? rawItem.unit_price
                    : (variant ? (variant.price!==null ? variant.price : variant.product?.base_price) : 0)
            );
            const amount=money(
                rawItem.amount!==undefined && Number(rawItem.amount)>=0
                    ? rawItem.amount
                    : unit_price*quantity
            );
            await OrderItem.create({
                orderId:order.id,
                variantId:variant ? variant.id : null,
                product_name:rawItem.product_name || variant?.product?.name || "Product",
                sku:rawItem.sku || variant?.sku || "SKU-001",
                color:rawItem.color ?? variant?.color ?? null,
                size:rawItem.size ?? variant?.size ?? null,
                unit_price,
                quantity,
                amount
            },{transaction:t});
        }
        if(body.sub_total===undefined || Number(body.sub_total)===0){
            await recalculateOrderTotals(order.id,t);
        }
    }

    return findOrder({id:order.id},t);
});

// PUT /order/admin/:id, PATCH /order/admin/:id, PATCH /order/admin/:id/pricing, PATCH /order/admin/:id/status
const updateOrder=async(id,body={})=>sequelize.transaction(async(t)=>{
    const order=await findOrder({id},t,t.LOCK.UPDATE);

    if(body.status!==undefined){
        const next=normalizeOrderStatus(body.status);
        if(next!==order.status){
            if(next==="cancelled" && order.status!=="cancelled"){
                await restoreStock(order,t);
            }
            order.status=next;
        }
    }

    let pricingChanged=false;
    if(body.sub_total!==undefined){
        const nextSubTotal=parseNonNegativeMoney(body.sub_total,"sub_total");
        if(nextSubTotal!==undefined){
            order.sub_total=nextSubTotal;
            pricingChanged=true;
        }
    }
    if(body.discount!==undefined){
        const nextDiscount=parseNonNegativeMoney(body.discount,"discount");
        if(nextDiscount!==undefined){
            order.discount=nextDiscount;
            pricingChanged=true;
        }
    }
    const rawShipping=body.shipping_fee!==undefined ? body.shipping_fee : body.shipping;
    if(rawShipping!==undefined){
        const nextShipping=parseNonNegativeMoney(rawShipping,"shipping_fee");
        if(nextShipping!==undefined){
            order.shipping_fee=nextShipping;
            pricingChanged=true;
        }
    }

    if(pricingChanged){
        const sub=Number(order.sub_total || 0);
        const disc=Number(order.discount || 0);
        const ship=Number(order.shipping_fee || 0);
        if(sub>0 || disc>0 || ship>0){
            order.total=money(Math.max(0,sub-disc+ship));
        }
        else if(body.total!==undefined){
            const explicitTotal=parseNonNegativeMoney(body.total,"total");
            if(explicitTotal!==undefined) order.total=explicitTotal;
        }
        else{
            order.total=0;
        }
    }
    else if(body.total!==undefined){
        const explicitTotal=parseNonNegativeMoney(body.total,"total");
        if(explicitTotal!==undefined) order.total=explicitTotal;
    }

    if(body.addressId!==undefined){
        if(body.addressId===null){
            order.addressId=null;
        }
        else{
            const addr=await Address.findByPk(body.addressId,{transaction:t});
            if(addr) order.addressId=addr.id;
        }
    }
    if(body.shipping_receiver_name!==undefined && String(body.shipping_receiver_name).trim()){
        order.shipping_receiver_name=String(body.shipping_receiver_name).trim();
    }
    if(body.shipping_phone!==undefined && String(body.shipping_phone).trim()){
        order.shipping_phone=String(body.shipping_phone).trim();
    }
    if(body.shipping_street!==undefined && String(body.shipping_street).trim()){
        order.shipping_street=String(body.shipping_street).trim();
    }
    if(body.shipping_city!==undefined && String(body.shipping_city).trim()){
        order.shipping_city=String(body.shipping_city).trim();
    }

    await order.save({transaction:t});
    return findOrder({id:order.id},t);
});

const updateStatus=updateOrder;

// DELETE /order/admin/:id
const removeOrder=async(id)=>sequelize.transaction(async(t)=>{
    const order=await findOrder({id},t,t.LOCK.UPDATE);
    if(order.status!=="cancelled"){
        await restoreStock(order,t);
    }
    await OrderItem.destroy({where:{orderId:order.id},transaction:t});
    await order.destroy({transaction:t});
});

// POST /order/admin/items
const createOrderItem=async(body={})=>sequelize.transaction(async(t)=>{
    let orderId=body.orderId;
    let order=orderId ? await Order.findByPk(orderId,{transaction:t}) : null;
    if(!order){
        order=await Order.findOne({order:[["id","DESC"]],transaction:t});
    }
    if(!order) throw new AppError(404,"Order not found");

    let variant=null;
    if(body.variantId){
        variant=await ProductVariant.findByPk(body.variantId,{
            include:[{model:Product,as:"product",attributes:["id","name","base_price"]}],
            transaction:t
        });
    }
    if(!variant && body.sku){
        variant=await ProductVariant.findOne({
            where:{sku:String(body.sku).trim()},
            include:[{model:Product,as:"product",attributes:["id","name","base_price"]}],
            transaction:t
        });
    }
    if(!variant){
        variant=await ProductVariant.findOne({
            include:[{model:Product,as:"product",attributes:["id","name","base_price"]}],
            order:[["id","ASC"]],
            transaction:t
        });
    }

    const quantity=Math.max(1,parseInt(body.quantity ?? 1,10) || 1);
    const unit_price=money(
        body.unit_price!==undefined && Number(body.unit_price)>0
            ? body.unit_price
            : (variant ? (variant.price!==null ? variant.price : variant.product?.base_price) : 0)
    );
    const amount=money(body.amount!==undefined && Number(body.amount)>0 ? body.amount : unit_price*quantity);

    const item=await OrderItem.create({
        orderId:order.id,
        variantId:variant ? variant.id : null,
        product_name:body.product_name || variant?.product?.name || "Product",
        sku:body.sku || variant?.sku || "SKU-001",
        color:variant?.color || null,
        size:variant?.size || null,
        unit_price,
        quantity,
        amount
    },{transaction:t});

    await recalculateOrderTotals(order.id,t);
    return item;
});

// PUT /order/admin/items/:id
const updateOrderItem=async(id,body={})=>sequelize.transaction(async(t)=>{
    const item=await OrderItem.findByPk(id,{transaction:t});
    if(!item) throw new AppError(404,"Order item not found");

    if(body.product_name!==undefined && String(body.product_name).trim()){
        item.product_name=String(body.product_name).trim();
    }
    if(body.sku!==undefined && String(body.sku).trim()){
        item.sku=String(body.sku).trim();
    }
    if(body.unit_price!==undefined){
        item.unit_price=money(body.unit_price);
    }
    if(body.quantity!==undefined){
        item.quantity=Math.max(1,parseInt(body.quantity,10) || 1);
    }
    item.amount=money(
        body.amount!==undefined && Number(body.amount)>0
            ? body.amount
            : Number(item.unit_price)*Number(item.quantity)
    );

    await item.save({transaction:t});
    await recalculateOrderTotals(item.orderId,t);
    return item;
});

// DELETE /order/admin/items/:id
const removeOrderItem=async(id)=>sequelize.transaction(async(t)=>{
    const item=await OrderItem.findByPk(id,{transaction:t});
    if(!item) throw new AppError(404,"Order item not found");
    const orderId=item.orderId;
    await item.destroy({transaction:t});
    await recalculateOrderTotals(orderId,t);
});

module.exports={
    checkout,
    listMine,
    getMine,
    cancelMine,
    listAll,
    getAny,
    createAdminOrder,
    updateOrder,
    updateStatus,
    removeOrder,
    createOrderItem,
    updateOrderItem,
    removeOrderItem
};
