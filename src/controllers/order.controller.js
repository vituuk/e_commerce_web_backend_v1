const orderService=require("../services/order.service");
const telegramService=require("../services/telegram.service");
const emailService=require("../services/email.service");

// AppError -> its status; anything else -> 500 with a generic message
const handleError=(res,error,label)=>{
    if(error.status){
        return res.status(error.status).json({message:error.message});
    }
    console.log(`${label} error`,error);
    return res.status(500).json({message:`${label} failed`});
};

// POST /order   body: {addressId?, discount?, shipping_fee?, shipping?}
const checkout=async(req,res)=>{
    try{
        const data=await orderService.checkout(req.user.id,req.body || {});
        // Fire-and-forget Telegram and Email alerts when user buys successfully
        telegramService.notifyOrderPlaced(data, req.user).catch((err) => {
            console.error("[Telegram] Error sending order notification:", err?.message || err);
        });
        emailService.notifyOrderPlaced(data, req.user).catch((err) => {
            console.error("[Email] Error sending order notification:", err?.message || err);
        });
        return res.status(201).json({message:"Order placed",data});
    }
    catch(error){
        return handleError(res,error,"Checkout");
    }
};

// GET /order
const listMine=async(req,res)=>{
    try{
        const {rows,pagination}=await orderService.listMine(req.user.id,req.query);
        return res.status(200).json({message:"My orders",data:rows,pagination});
    }
    catch(error){
        return handleError(res,error,"Get my orders");
    }
};

// GET /order/:id
const getMine=async(req,res)=>{
    try{
        const data=await orderService.getMine(req.user.id,req.params.id);
        return res.status(200).json({message:"Order",data});
    }
    catch(error){
        return handleError(res,error,"Get order");
    }
};

// PATCH /order/:id/cancel
const cancelMine=async(req,res)=>{
    try{
        const data=await orderService.cancelMine(req.user.id,req.params.id);
        return res.status(200).json({message:"Order cancelled",data});
    }
    catch(error){
        return handleError(res,error,"Cancel order");
    }
};

// GET /order/admin?status=
const listAll=async(req,res)=>{
    try{
        const {rows,pagination}=await orderService.listAll(req.query);
        return res.status(200).json({message:"All orders",data:rows,pagination});
    }
    catch(error){
        return handleError(res,error,"Get all orders");
    }
};

// POST /order/admin
const createAdminOrder=async(req,res)=>{
    try{
        const data=await orderService.createAdminOrder(req.user,req.body || {});
        telegramService.notifyOrderPlaced(data, req.user).catch((err) => {
            console.error("[Telegram] Error sending admin order notification:", err?.message || err);
        });
        return res.status(201).json({message:"Order created",data});
    }
    catch(error){
        return handleError(res,error,"Create order");
    }
};

// GET /order/admin/:id
const getAny=async(req,res)=>{
    try{
        const data=await orderService.getAny(req.params.id);
        return res.status(200).json({message:"Order",data});
    }
    catch(error){
        return handleError(res,error,"Get order");
    }
};

// PUT /order/admin/:id or PATCH /order/admin/:id or PATCH /order/admin/:id/pricing
const updateOrder=async(req,res)=>{
    try{
        const data=await orderService.updateOrder(req.params.id,req.body || {});
        return res.status(200).json({message:"Order updated",data});
    }
    catch(error){
        return handleError(res,error,"Update order");
    }
};

// PATCH /order/admin/:id/status   body: {status, discount?, shipping_fee?}
const updateStatus=async(req,res)=>{
    try{
        const data=await orderService.updateStatus(req.params.id,req.body || {});
        return res.status(200).json({message:"Order status updated",data});
    }
    catch(error){
        return handleError(res,error,"Update order status");
    }
};

// DELETE /order/admin/:id
const removeOrder=async(req,res)=>{
    try{
        await orderService.removeOrder(req.params.id);
        return res.status(200).json({message:"Order deleted"});
    }
    catch(error){
        return handleError(res,error,"Delete order");
    }
};

// POST /order/admin/items
const createOrderItem=async(req,res)=>{
    try{
        const data=await orderService.createOrderItem(req.body || {});
        return res.status(201).json({message:"Order item created",data});
    }
    catch(error){
        return handleError(res,error,"Create order item");
    }
};

// PUT /order/admin/items/:id
const updateOrderItem=async(req,res)=>{
    try{
        const data=await orderService.updateOrderItem(req.params.id,req.body || {});
        return res.status(200).json({message:"Order item updated",data});
    }
    catch(error){
        return handleError(res,error,"Update order item");
    }
};

// DELETE /order/admin/items/:id
const removeOrderItem=async(req,res)=>{
    try{
        await orderService.removeOrderItem(req.params.id);
        return res.status(200).json({message:"Order item deleted"});
    }
    catch(error){
        return handleError(res,error,"Delete order item");
    }
};

module.exports={
    checkout,
    listMine,
    getMine,
    cancelMine,
    listAll,
    createAdminOrder,
    getAny,
    updateOrder,
    updateStatus,
    removeOrder,
    createOrderItem,
    updateOrderItem,
    removeOrderItem
};
