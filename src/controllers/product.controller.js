const productService=require("../services/product.service");
const handleError=require("../util/handle-error");

// GET /product?categoryId=&q=&page=&limit=
const list=async(req,res)=>{
    try{
        const {rows,pagination}=await productService.list(req.query);
        return res.status(200).json({message:"Get products successfully",data:rows,pagination});
    }
    catch(error){
        return handleError(res,error,"Get products");
    }
};

// GET /product/:id
const getById=async(req,res)=>{
    try{
        const data=await productService.getById(req.params.id);
        return res.status(200).json({message:"Get product successfully",data});
    }
    catch(error){
        return handleError(res,error,"Get product");
    }
};

// POST /product
const create=async(req,res)=>{
    try{
        const data=await productService.create(req.body || {});
        return res.status(201).json({message:"Product created",data});
    }
    catch(error){
        return handleError(res,error,"Create product");
    }
};

// PUT /product/:id
const update=async(req,res)=>{
    try{
        const data=await productService.update(req.params.id,req.body || {});
        return res.status(200).json({message:"Product updated",data});
    }
    catch(error){
        return handleError(res,error,"Update product");
    }
};

// DELETE /product/:id
const remove=async(req,res)=>{
    try{
        await productService.remove(req.params.id);
        return res.status(200).json({message:"Product deleted"});
    }
    catch(error){
        return handleError(res,error,"Delete product");
    }
};

module.exports={list,getById,create,update,remove};
