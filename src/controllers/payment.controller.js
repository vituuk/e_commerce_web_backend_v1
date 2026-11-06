const paymentService=require("../services/payment.service");

// AppError -> its status; anything else -> 500 with a generic message
const handleError=(res,error,label)=>{
    if(error.status){
        return res.status(error.status).json({message:error.message});
    }
    console.log(`${label} error`,error);
    return res.status(500).json({message:`${label} failed`});
};

// POST /payment/checkout
const checkout=async(req,res)=>{
    try{
        const data=await paymentService.createCheckout(req.user,req.body || {});
        return res.status(201).json({message:"Payment created, submit fields to action_url",data});
    }
    catch(error){
        return handleError(res,error,"Create payment");
    }
};

// POST /payment/callback (PayWay pushback, public)
const callback=async(req,res)=>{
    try{
        const data=await paymentService.handleCallback(req.body || {});
        return res.status(200).json({message:"OK",status:data.status});
    }
    catch(error){
        return handleError(res,error,"Payment callback");
    }
};

// GET /payment/verify/:tranId
const verify=async(req,res)=>{
    try{
        const data=await paymentService.verifyMine(req.user,req.params.tranId);
        return res.status(200).json({message:"Payment status",data});
    }
    catch(error){
        return handleError(res,error,"Verify payment");
    }
};

// GET /payment
const listMine=async(req,res)=>{
    try{
        const {rows,pagination}=await paymentService.listMine(req.user.id,req.query);
        return res.status(200).json({message:"My payments",data:rows,pagination});
    }
    catch(error){
        return handleError(res,error,"Get my payments");
    }
};

// GET /payment/admin?status=
const listAll=async(req,res)=>{
    try{
        const {rows,pagination}=await paymentService.listAll(req.query);
        return res.status(200).json({message:"All payments",data:rows,pagination});
    }
    catch(error){
        return handleError(res,error,"Get all payments");
    }
};

// POST /payment/admin
const createAdminPayment=async(req,res)=>{
    try{
        const data=await paymentService.createAdminPayment(req.user,req.body || {});
        return res.status(201).json({message:"Payment created",data});
    }
    catch(error){
        return handleError(res,error,"Create payment");
    }
};

// PUT /payment/admin/:id
const updateAdminPayment=async(req,res)=>{
    try{
        const data=await paymentService.updateAdminPayment(req.params.id,req.body || {});
        return res.status(200).json({message:"Payment updated",data});
    }
    catch(error){
        return handleError(res,error,"Update payment");
    }
};

// DELETE /payment/admin/:id
const removeAdminPayment=async(req,res)=>{
    try{
        await paymentService.removeAdminPayment(req.params.id);
        return res.status(200).json({message:"Payment deleted"});
    }
    catch(error){
        return handleError(res,error,"Delete payment");
    }
};

module.exports={
    checkout,
    callback,
    verify,
    listMine,
    listAll,
    createAdminPayment,
    updateAdminPayment,
    removeAdminPayment
};
