const categoryService=require("../services/category.service");
const handleError=require("../util/handle-error");

// GET /category?q=&is_active=&page=&limit=
const list=async(req,res)=>{
    try{
        const {rows,pagination}=await categoryService.list(req.query);
        return res.status(200).json({message:"Get categories successfully",data:rows,pagination});
    }
    catch(error){
        return handleError(res,error,"Get categories");
    }
};

// GET /category/:id
const getById=async(req,res)=>{
    try{
        const data=await categoryService.getById(req.params.id);
        return res.status(200).json({message:"Get category successfully",data});
    }
    catch(error){
        return handleError(res,error,"Get category");
    }
};

// POST /category
const create=async(req,res)=>{
    try{
        const data=await categoryService.create(req.body || {});
        return res.status(201).json({message:"Category created",data});
    }
    catch(error){
        return handleError(res,error,"Create category");
    }
};

// PUT /category/:id
const update=async(req,res)=>{
    try{
        const data=await categoryService.update(req.params.id,req.body || {});
        return res.status(200).json({message:"Category updated",data});
    }
    catch(error){
        return handleError(res,error,"Update category");
    }
};

// DELETE /category/:id
const remove=async(req,res)=>{
    try{
        await categoryService.remove(req.params.id);
        return res.status(200).json({message:"Category deleted"});
    }
    catch(error){
        return handleError(res,error,"Delete category");
    }
};

module.exports={list,getById,create,update,remove};
