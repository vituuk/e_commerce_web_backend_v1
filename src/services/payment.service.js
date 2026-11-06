const {Payment,Order,OrderItem,User,sequelize}=require("../../models");
const AppError=require("../util/app-error");
const {paginate}=require("../util/paginate");
const {getReqTime,buildPurchaseHash,encodeBase64,buildCheckTransactionHash}=require("../util/payway");
const telegramService=require("./telegram.service");
const emailService=require("./email.service");

const BASE_URL=process.env.ABA_PAYWAY_BASE_URL || "https://checkout-sandbox.payway.com.kh";
const PURCHASE_URL=`${BASE_URL}/api/payment-gateway/v1/payments/purchase`;
const CHECK_URL=`${BASE_URL}/api/payment-gateway/v1/payments/check-transaction-2`;
const ALLOWED_OPTIONS=["abapay_khqr","abapay_khqr_deeplink","cards","alipay","wechat"];

const money=(n)=>Number(n || 0).toFixed(2);

const normalizePaymentStatus=(raw)=>{
    const s=String(raw || "pending").trim().toLowerCase();
    if(s==="succeeded" || s==="paid" || s==="approved" || s==="complete" || s==="completed") return "success";
    if(s==="declined" || s==="cancelled" || s==="canceled" || s==="error") return "failed";
    return Payment.STATUSES.includes(s) ? s : "pending";
};

const requireConfig=()=>{
    if(!process.env.ABA_PAYWAY_MERCHANT_ID || !process.env.ABA_PAYWAY_API_KEY){
        throw new AppError(500,"PayWay is not configured (ABA_PAYWAY_MERCHANT_ID / ABA_PAYWAY_API_KEY)");
    }
};

// unique, max 20 chars (PayWay limit), e.g. "12-mgq3k2x1"
const generateTranId=(orderId)=>`${orderId}-${Date.now().toString(36)}`.slice(0,20);

// POST /payment/checkout  body: {orderId, payment_option?}
// creates a pending Payment and returns the form fields the frontend must POST to PayWay
const createCheckout=async(user,body)=>{
    requireConfig();
    const {orderId}=body;
    const payment_option=body.payment_option || "abapay_khqr";
    if(!orderId) throw new AppError(400,"orderId is required");
    if(!ALLOWED_OPTIONS.includes(payment_option)) throw new AppError(400,`payment_option must be one of: ${ALLOWED_OPTIONS.join(", ")}`);

    const isAdmin=(user.roles || []).includes("admin") || (user.roles || []).includes("superadmin");
    const where=isAdmin ? {id:orderId} : {id:orderId,userId:user.id};
    const order=await Order.findOne({
        where,
        include:[{model:OrderItem,as:"items"}]
    });
    if(!order) throw new AppError(404,"Order not found");
    if(order.status!=="pending") throw new AppError(400,`Order is ${order.status}, cannot pay`);

    const dbUser=await User.findByPk(order.userId,{attributes:["firstName","lastName","email"]});

    const tran_id=generateTranId(order.id);
    const payment=await Payment.create({
        userId:order.userId,
        orderId:order.id,
        paywayTranId:tran_id,
        method:payment_option,
        amount:order.total,
        status:"pending"
    });

    const items=encodeBase64(JSON.stringify((order.items || []).map(i=>({
        name:i.product_name,
        quantity:i.quantity,
        price:Number(i.unit_price)
    }))));

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const returnUrl = process.env.ABA_PAYWAY_RETURN_URL
        ? encodeBase64(process.env.ABA_PAYWAY_RETURN_URL)
        : "";
    const cancelUrl = process.env.ABA_PAYWAY_CANCEL_URL || `${frontendUrl}/checkout`;
    const continueSuccessUrl = process.env.ABA_PAYWAY_SUCCESS_URL || `${frontendUrl}/checkout?tranId=${tran_id}`;
    const cleanPhone = String(order.shipping_phone || "012345678").replace(/\s+/g, "");

    // every field in the hash must be sent exactly as hashed (empty string if unused)
    const fields={
        req_time:getReqTime(),
        merchant_id:process.env.ABA_PAYWAY_MERCHANT_ID,
        tran_id,
        amount:money(order.total),
        items,
        shipping:money(order.shipping_fee),
        firstname:dbUser?.firstName || "Customer",
        lastname:dbUser?.lastName || "Buyer",
        email:dbUser?.email || process.env.ABA_PAYWAY_MERCHANT_EMAIL || "customer@example.com",
        phone:cleanPhone,
        type:"purchase",
        payment_option,
        return_url:returnUrl,
        cancel_url:cancelUrl,
        continue_success_url:continueSuccessUrl,
        currency:"USD"
    };
    fields.hash=buildPurchaseHash(fields);

    // Required by AbaPayway checkout popup modal (not part of the HMAC hash)
    fields.view_type = "popup";
    fields.payment_gate = 0;

    const payway = {
        action: PURCHASE_URL,
        method: "POST",
        target: "aba_webservice",
        id: "aba_merchant_request",
        fields
    };

    return {
        payment,
        action_url: PURCHASE_URL,
        method: "POST",
        target: "aba_webservice",
        id: "aba_merchant_request",
        fields,
        payway
    };
};

// ask PayWay for the real status (never trust the callback body alone)
const checkWithPayWay=async(tran_id)=>{
    requireConfig();
    const req_time=getReqTime();
    const merchant_id=process.env.ABA_PAYWAY_MERCHANT_ID;
    const hash=buildCheckTransactionHash({req_time,merchant_id,tran_id});

    const res=await fetch(CHECK_URL,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({req_time,merchant_id,tran_id,hash})
    });
    const json=await res.json().catch(()=>({}));
    const data=json.data || {};
    // payment_status_code 0 = APPROVED
    const approved=data.payment_status_code===0 || data.payment_status==="APPROVED";
    const failed=["DECLINED","CANCELLED","REFUNDED"].includes(data.payment_status);
    return {approved,failed,data,raw:json};
};

// update Payment + Order from PayWay's answer (idempotent: safe to call many times)
const syncPayment=async(tran_id)=>{
    const result=await checkWithPayWay(tran_id);

    const payment=await sequelize.transaction(async(t)=>{
        const payment=await Payment.findOne({where:{paywayTranId:tran_id},transaction:t,lock:t.LOCK.UPDATE});
        if(!payment) throw new AppError(404,"Payment not found");
        if(payment.status==="success") return payment; // already done

        if(result.approved){
            const paidAmount=result.data.payment_amount!==undefined ? Number(result.data.payment_amount) : Number(payment.amount);
            if(money(paidAmount)!==money(payment.amount)){
                payment.status="failed";
                payment.remark=`Amount mismatch: expected ${money(payment.amount)}, got ${money(paidAmount)}`;
                await payment.save({transaction:t});
                return payment;
            }

            payment.status="success";
            payment.paidAt=new Date();
            if(result.data.payment_type) payment.method=result.data.payment_type;
            payment.remark=result.data.apv ? `APV: ${result.data.apv}` : payment.remark;
            await payment.save({transaction:t});

            const order=await Order.findByPk(payment.orderId,{transaction:t,lock:t.LOCK.UPDATE});
            if(order.status==="pending"){
                order.status="paid";
                await order.save({transaction:t});
            }
            else{
                payment.remark=`${payment.remark || ""} | Paid while order was ${order.status}: refund may be needed`.trim();
                await payment.save({transaction:t});
            }
        }
        else if(result.failed){
            payment.status="failed";
            payment.remark=`PayWay status: ${result.data.payment_status}`;
            await payment.save({transaction:t});
        }
        // otherwise still pending: leave as is
        return payment;
    });

    if(result.approved && payment && payment.status==="success"){
        telegramService.notifyPaymentSuccess(payment).catch((err)=>{
            console.error("[Telegram] Error notifying payment success:", err?.message || err);
        });
        emailService.notifyPaymentSuccess(payment).catch((err)=>{
            console.error("[Email] Error notifying payment success:", err?.message || err);
        });
    }

    return payment;
};

// POST /payment/callback (called by PayWay server)
const handleCallback=async(body)=>{
    const tran_id=body.tran_id;
    if(!tran_id) throw new AppError(400,"tran_id is required");
    return syncPayment(tran_id);
};

// GET /payment/verify/:tranId (user checks own payment, e.g. when callback can't reach localhost)
const verifyMine=async(user,tran_id)=>{
    const payment=await Payment.findOne({where:{paywayTranId:tran_id,userId:user.id}});
    if(!payment) throw new AppError(404,"Payment not found");
    return syncPayment(tran_id);
};

// shared filters: status, method, orderId
const buildPaymentWhere=(query)=>{
    const where={};
    if(query.status){
        where.status=normalizePaymentStatus(query.status);
    }
    if(query.method) where.method=query.method;
    if(query.orderId) where.orderId=query.orderId;
    return where;
};

// ?status=&method=&orderId=&page=&limit=
const listMine=async(userId,query={})=>paginate(Payment,{
    where:{...buildPaymentWhere(query),userId},
    include:[{model:Order,as:"order",attributes:["id","order_number","total","status"]}],
    order:[["createdAt","DESC"]]
},query);

// ?status=&method=&orderId=&userId=&page=&limit=
const listAll=async(query)=>{
    const where=buildPaymentWhere(query);
    if(query.userId) where.userId=query.userId;
    return paginate(Payment,{
        where,
        include:[
            {model:Order,as:"order",attributes:["id","order_number","total","status"]},
            {model:User,as:"user",attributes:["id","firstName","lastName","email"]}
        ],
        order:[["createdAt","DESC"]]
    },query);
};

// POST /payment/admin : admin records/creates a payment directly
const createAdminPayment=async(user,body={})=>sequelize.transaction(async(t)=>{
    let order=body.orderId ? await Order.findByPk(body.orderId,{transaction:t}) : null;
    if(!order){
        order=await Order.findOne({order:[["id","DESC"]],transaction:t});
    }
    if(!order) throw new AppError(404,"Order not found");

    const status=normalizePaymentStatus(body.status || "pending");
    const method=body.method && String(body.method).trim() ? String(body.method).trim() : "abapay_khqr";
    const amount=body.amount!==undefined && Number(body.amount)>0 ? Number(body.amount) : Number(order.total || 0);
    const paidAt=status==="success" ? new Date() : null;

    const payment=await Payment.create({
        userId:order.userId || user.id,
        orderId:order.id,
        paywayTranId:generateTranId(order.id),
        method,
        amount,
        status,
        paidAt
    },{transaction:t});

    if(status==="success" && order.status==="pending"){
        order.status="paid";
        await order.save({transaction:t});
    }

    if(status==="success"){
        telegramService.notifyPaymentSuccess(payment, order).catch((err)=>{
            console.error("[Telegram] Error notifying admin payment success:", err?.message || err);
        });
    }

    return payment;
});

// PUT /payment/admin/:id : admin updates payment method, amount, or status
const updateAdminPayment=async(id,body={})=>sequelize.transaction(async(t)=>{
    const payment=await Payment.findByPk(id,{transaction:t,lock:t.LOCK.UPDATE});
    if(!payment) throw new AppError(404,"Payment not found");

    if(body.method!==undefined && String(body.method).trim()){
        payment.method=String(body.method).trim();
    }
    if(body.amount!==undefined && !isNaN(Number(body.amount))){
        payment.amount=Number(body.amount);
    }
    if(body.status!==undefined){
        const nextStatus=normalizePaymentStatus(body.status);
        payment.status=nextStatus;
        if(nextStatus==="success" && !payment.paidAt){
            payment.paidAt=new Date();
        }
        if(nextStatus==="success"){
            const order=await Order.findByPk(payment.orderId,{transaction:t,lock:t.LOCK.UPDATE});
            if(order && order.status==="pending"){
                order.status="paid";
                await order.save({transaction:t});
            }
        }
    }
    await payment.save({transaction:t});
    return payment;
});

// DELETE /payment/admin/:id : admin deletes payment record
const removeAdminPayment=async(id)=>{
    const payment=await Payment.findByPk(id);
    if(!payment) throw new AppError(404,"Payment not found");
    await payment.destroy();
};

module.exports={
    createCheckout,
    handleCallback,
    verifyMine,
    listMine,
    listAll,
    createAdminPayment,
    updateAdminPayment,
    removeAdminPayment
};
