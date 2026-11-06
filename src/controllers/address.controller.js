const addressService=require("../services/address.service");

// AppError -> its status; anything else -> 500 with a generic message
const handleError=(res,error,label)=>{
    if(error.status){
        return res.status(error.status).json({message:error.message});
    }
    console.log(`${label} error`,error);
    return res.status(500).json({message:`${label} failed`});
};

// GET /address
const list=async(req,res)=>{
    try{
        const {rows,pagination}=await addressService.list(req.user.id,req.query);
        return res.status(200).json({message:"Addresses",data:rows,pagination});
    }
    catch(error){
        return handleError(res,error,"Get addresses");
    }
};

// GET /address/admin
const listAll=async(req,res)=>{
    try{
        const {rows,pagination}=await addressService.listAll(req.query);
        return res.status(200).json({message:"All addresses",data:rows,pagination});
    }
    catch(error){
        return handleError(res,error,"Get all addresses");
    }
};

// GET /address/default
const getDefault=async(req,res)=>{
    try{
        const data=await addressService.getDefault(req.user.id);
        return res.status(200).json({message:"Default address",data});
    }
    catch(error){
        return handleError(res,error,"Get default address");
    }
};

// GET /address/:id
const getOne=async(req,res)=>{
    try{
        const data=await addressService.getOne(req.user,req.params.id);
        return res.status(200).json({message:"Address",data});
    }
    catch(error){
        return handleError(res,error,"Get address");
    }
};

// POST /address
const create=async(req,res)=>{
    try{
        const data=await addressService.create(req.user,req.body || {});
        return res.status(201).json({message:"Address created",data});
    }
    catch(error){
        return handleError(res,error,"Create address");
    }
};

// PUT /address/:id
const update=async(req,res)=>{
    try{
        const data=await addressService.update(req.user,req.params.id,req.body || {});
        return res.status(200).json({message:"Address updated",data});
    }
    catch(error){
        return handleError(res,error,"Update address");
    }
};

// PATCH /address/:id/default
const setDefault=async(req,res)=>{
    try{
        const data=await addressService.setDefault(req.user,req.params.id);
        return res.status(200).json({message:"Default address set",data});
    }
    catch(error){
        return handleError(res,error,"Set default address");
    }
};

// DELETE /address/:id
const remove=async(req,res)=>{
    try{
        await addressService.remove(req.user,req.params.id);
        return res.status(200).json({message:"Address deleted"});
    }
    catch(error){
        return handleError(res,error,"Delete address");
    }
};

module.exports={list,listAll,getDefault,getOne,create,update,setDefault,remove};
