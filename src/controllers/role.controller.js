const roleService=require("../services/role.service");
const handleError=require("../util/handle-error");

// GET /role?q=&status=&page=&limit=
const list=async(req,res)=>{
    try{
        const {rows,pagination}=await roleService.list(req.query);
        return res.status(200).json({message:"Get roles successfully",data:rows,pagination});
    }
    catch(error){
        return handleError(res,error,"Get roles");
    }
};

// GET /role/:id
const getById=async(req,res)=>{
    try{
        const data=await roleService.getById(req.params.id);
        return res.status(200).json({message:"Get role successfully",data});
    }
    catch(error){
        return handleError(res,error,"Get role");
    }
};

// POST /role   body: {name, code, status}
const create=async(req,res)=>{
    try{
        const data=await roleService.create(req.body || {});
        return res.status(201).json({message:"Role created",data});
    }
    catch(error){
        return handleError(res,error,"Create role");
    }
};

// PUT /role/:id
const update=async(req,res)=>{
    try{
        const data=await roleService.update(req.params.id,req.body || {});
        return res.status(200).json({message:"Role updated",data});
    }
    catch(error){
        return handleError(res,error,"Update role");
    }
};

// DELETE /role/:id
const remove=async(req,res)=>{
    try{
        await roleService.remove(req.params.id);
        return res.status(200).json({message:"Role deleted"});
    }
    catch(error){
        return handleError(res,error,"Delete role");
    }
};

module.exports={list,getById,create,update,remove};
