const {Cart,CartItem,ProductVariant,Product,User}=require("../../models");
const AppError=require("../util/app-error");

const itemInclude=[{
    model:ProductVariant,
    as:"variant",
    attributes:["id","sku","color","size","price","stock_qty","is_active"],
    include:[{model:Product,as:"product",attributes:["id","name","slug","base_price"]}]
}];

const isAdminUser=(user)=>{
    const roles=(user && user.roles) || [];
    return roles.includes("admin") || roles.includes("superadmin");
};

const validateQuantity=(quantity)=>{
    if(!Number.isInteger(Number(quantity)) || Number(quantity)<1) throw new AppError(400,"quantity must be an integer >= 1");
    return Number(quantity);
};

// get the user's cart, create it if it doesn't exist yet
const getOrCreateCart=async(userId)=>{
    const [cart]=await Cart.findOrCreate({where:{userId},defaults:{userId}});
    return cart;
};

// load an active variant + check stock
const loadVariant=async(variantId,quantity)=>{
    const variant=await ProductVariant.findByPk(variantId);
    if(!variant || !variant.is_active) throw new AppError(404,"Variant not found");
    if(quantity>variant.stock_qty) throw new AppError(400,`Only ${variant.stock_qty} left in stock`);
    return variant;
};

const findItem=async(cartId,itemId,allowAnyCart=false)=>{
    const where=allowAnyCart ? {id:itemId} : {id:itemId,cartId};
    const item=await CartItem.findOne({where});
    if(!item) throw new AppError(404,"Cart item not found");
    return item;
};

// build response with unit_price, line_total, totals
const getCart=async(userId)=>{
    const cart=await getOrCreateCart(userId);
    const items=await CartItem.findAll({
        where:{cartId:cart.id},
        include:itemInclude,
        order:[["id","ASC"]]
    });

    let total_qty=0;
    let total_price=0;
    const data=items.map(i=>{
        const json=i.toJSON();
        const v=json.variant;
        const unit=Number(v && v.price!==null ? v.price : (v?.product?.base_price || 0));
        json.unit_price=unit;
        json.line_total=+(unit*json.quantity).toFixed(2);
        total_qty+=json.quantity;
        total_price+=json.line_total;
        return json;
    });

    return {id:cart.id,userId:cart.userId,items:data,total_qty,total_price:+total_price.toFixed(2)};
};

// admin: list all carts with user + items
const listAllCarts=async(callerId)=>{
    if(callerId) await getOrCreateCart(callerId);
    const carts=await Cart.findAll({
        include:[
            {model:User,as:"user",attributes:["id","firstName","lastName","email"]},
            {model:CartItem,as:"items",include:itemInclude}
        ],
        order:[["id","ASC"]]
    });
    return carts;
};

// admin: create cart for user
const createCartForUser=async(targetUserId)=>{
    const user=await User.findByPk(targetUserId);
    if(!user) throw new AppError(404,"User not found");
    const cart=await getOrCreateCart(user.id);
    return Cart.findByPk(cart.id,{
        include:[
            {model:User,as:"user",attributes:["id","firstName","lastName","email"]},
            {model:CartItem,as:"items",include:itemInclude}
        ]
    });
};

// admin: update cart by id
const updateCartById=async(cartId,body={})=>{
    const cart=await Cart.findByPk(cartId);
    if(!cart) throw new AppError(404,"Cart not found");

    if(body.userId!==undefined && Number(body.userId)>0 && Number(body.userId)!==cart.userId){
        const targetUser=await User.findByPk(body.userId);
        if(!targetUser) throw new AppError(404,"User not found");
        const existingOther=await Cart.findOne({where:{userId:targetUser.id}});
        if(existingOther && existingOther.id!==cart.id){
            throw new AppError(409,"Target user already has a cart");
        }
        cart.userId=targetUser.id;
    }
    cart.changed("updatedAt",true);
    await cart.save();
    return Cart.findByPk(cart.id,{
        include:[
            {model:User,as:"user",attributes:["id","firstName","lastName","email"]},
            {model:CartItem,as:"items",include:itemInclude}
        ]
    });
};

// admin: delete cart by id
const deleteCartById=async(cartId)=>{
    const cart=await Cart.findByPk(cartId);
    if(!cart) throw new AppError(404,"Cart not found");
    await CartItem.destroy({where:{cartId:cart.id}});
    await cart.destroy();
};

// add variant; if already in cart, increase quantity
const addItem=async(user,body)=>{
    const userId=typeof user==="object" ? user.id : user;
    const {variantId,cartId}=body;
    if(!variantId) throw new AppError(400,"variantId is required");
    const quantity=validateQuantity(body.quantity ?? 1);

    let cart;
    if(isAdminUser(user) && cartId){
        cart=await Cart.findByPk(cartId);
    }
    if(!cart){
        cart=await getOrCreateCart(userId);
    }

    const existing=await CartItem.findOne({where:{cartId:cart.id,variantId}});
    const newQty=(existing ? existing.quantity : 0)+quantity;
    await loadVariant(variantId,newQty);

    if(existing){
        existing.quantity=newQty;
        await existing.save();
    }
    else{
        await CartItem.create({cartId:cart.id,variantId,quantity});
    }
    return getCart(cart.userId);
};

// set quantity (and optional variantId for admin) of an item
const updateItem=async(user,itemId,body)=>{
    const userId=typeof user==="object" ? user.id : user;
    const quantity=validateQuantity(body.quantity);
    const cart=await getOrCreateCart(userId);
    const item=await findItem(cart.id,itemId,isAdminUser(user));
    const nextVariantId=isAdminUser(user) && body.variantId && Number(body.variantId)>0
        ? Number(body.variantId)
        : item.variantId;
    await loadVariant(nextVariantId,quantity);

    item.variantId=nextVariantId;
    item.quantity=quantity;
    await item.save();
    return getCart(userId);
};

const removeItem=async(user,itemId)=>{
    const userId=typeof user==="object" ? user.id : user;
    const cart=await getOrCreateCart(userId);
    const item=await findItem(cart.id,itemId,isAdminUser(user));
    await item.destroy();
    return getCart(userId);
};

const clearCart=async(userId)=>{
    const cart=await getOrCreateCart(userId);
    await CartItem.destroy({where:{cartId:cart.id}});
    return getCart(userId);
};

module.exports={getCart,listAllCarts,createCartForUser,updateCartById,deleteCartById,addItem,updateItem,removeItem,clearCart};
