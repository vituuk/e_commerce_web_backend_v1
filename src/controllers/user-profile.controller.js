const profileService=require("../services/user-profile.service");
const handleError=require("../util/handle-error");

// GET /auth/profile
const getMine=async(req,res)=>{
    try{
        const data=await profileService.findUserProfile(req.user.id);
        return res.status(200).json({message:"Profile",data});
    }
    catch(error){
        return handleError(res,error,"Get profile");
    }
};

// POST /auth/profile
const create=async(req,res)=>{
    try{
        const data=await profileService.create(req.user.id,req.body || {});
        return res.status(201).json({message:"Profile created",data});
    }
    catch(error){
        return handleError(res,error,"Create profile");
    }
};

// PUT /auth/profile
const update=async(req,res)=>{
    try{
        const data=await profileService.update(req.user.id,req.body || {});
        return res.status(200).json({message:"Profile updated",data});
    }
    catch(error){
        return handleError(res,error,"Update profile");
    }
};

// GET /auth/profile/:userId (admin)
const getByUserId=async(req,res)=>{
    try{
        const data=await profileService.findUserProfile(req.params.userId);
        return res.status(200).json({message:"Profile",data});
    }
    catch(error){
        return handleError(res,error,"Get profile");
    }
};

// POST /auth/profile/:userId (admin)
const createByUserId=async(req,res)=>{
    try{
        const data=await profileService.create(req.params.userId,req.body || {});
        return res.status(201).json({message:"Profile created",data});
    }
    catch(error){
        return handleError(res,error,"Create profile");
    }
};

// PUT /auth/profile/:userId (admin)
const updateByUserId=async(req,res)=>{
    try{
        const data=await profileService.update(req.params.userId,req.body || {});
        return res.status(200).json({message:"Profile updated",data});
    }
    catch(error){
        return handleError(res,error,"Update profile");
    }
};

// DELETE /auth/profile/:userId (admin)
const removeByUserId=async(req,res)=>{
    try{
        await profileService.remove(req.params.userId);
        return res.status(200).json({message:"Profile deleted"});
    }
    catch(error){
        return handleError(res,error,"Delete profile");
    }
};

module.exports={getMine,create,update,getByUserId,createByUserId,updateByUserId,removeByUserId};
