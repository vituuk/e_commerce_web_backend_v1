const reviewService=require("../services/review.service");

// AppError -> its status; anything else -> 500 with a generic message
const handleError=(res,error,label)=>{
    if(error.status){
        return res.status(error.status).json({message:error.message});
    }
    console.log(`${label} error`,error);
    return res.status(500).json({message:`${label} failed`});
};

// GET /product/:productId/reviews
const list=async(req,res)=>{
    try{
        const {data,pagination}=await reviewService.listByProduct(req.params.productId,req.query);
        return res.status(200).json({message:"Product reviews",data,pagination});
    }
    catch(error){
        return handleError(res,error,"Get product reviews");
    }
};

// GET /product/:productId/reviews/:id
const getOne=async(req,res)=>{
    try{
        const data=await reviewService.getOne(req.params.productId,req.params.id);
        return res.status(200).json({message:"Review",data});
    }
    catch(error){
        return handleError(res,error,"Get review");
    }
};

// POST /product/:productId/reviews   body: {rating, comment, userId?}
const create=async(req,res)=>{
    try{
        const data=await reviewService.create(req.user,req.params.productId,req.body || {});
        return res.status(201).json({message:"Review created",data});
    }
    catch(error){
        return handleError(res,error,"Create review");
    }
};

// PUT /product/:productId/reviews/:id
const update=async(req,res)=>{
    try{
        const data=await reviewService.update(req.user,req.params.productId,req.params.id,req.body || {});
        return res.status(200).json({message:"Review updated",data});
    }
    catch(error){
        return handleError(res,error,"Update review");
    }
};

// DELETE /product/:productId/reviews/:id
const remove=async(req,res)=>{
    try{
        await reviewService.remove(req.user,req.params.productId,req.params.id);
        return res.status(200).json({message:"Review deleted"});
    }
    catch(error){
        return handleError(res,error,"Delete review");
    }
};

module.exports={list,getOne,create,update,remove};
