const variantService=require("../services/product-variant.service");

// AppError -> its status; anything else -> 500 with a generic message
const handleError=(res,error,label)=>{
    if(error.status){
        return res.status(error.status).json({message:error.message});
    }
    console.log(`${label} error`,error);
    return res.status(500).json({message:`${label} failed`});
};

// GET /product/:productId/variants
const list=async(req,res)=>{
    try{
        const data=await variantService.listByProduct(req.params.productId);
        return res.status(200).json({message:"Product variants",data});
    }
    catch(error){
        return handleError(res,error,"Get product variants");
    }
};

// GET /product/:productId/variants/:id
const getOne=async(req,res)=>{
    try{
        const data=await variantService.getOne(req.params.productId,req.params.id);
        return res.status(200).json({message:"Product variant",data});
    }
    catch(error){
        return handleError(res,error,"Get product variant");
    }
};

// POST /product/:productId/variants
const create=async(req,res)=>{
    try{
        const data=await variantService.create(req.params.productId,req.body || {});
        return res.status(201).json({message:"Variant created",data});
    }
    catch(error){
        return handleError(res,error,"Create product variant");
    }
};

// PUT /product/:productId/variants/:id
const update=async(req,res)=>{
    try{
        const data=await variantService.update(req.params.productId,req.params.id,req.body || {});
        return res.status(200).json({message:"Variant updated",data});
    }
    catch(error){
        return handleError(res,error,"Update product variant");
    }
};

// DELETE /product/:productId/variants/:id
const remove=async(req,res)=>{
    try{
        await variantService.remove(req.params.productId,req.params.id);
        return res.status(200).json({message:"Variant deleted"});
    }
    catch(error){
        return handleError(res,error,"Delete product variant");
    }
};

module.exports={list,getOne,create,update,remove};
