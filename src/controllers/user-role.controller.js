const userRoleService=require("../services/user-role.service");
const handleError=require("../util/handle-error");

// GET /user-role/:userId
const getUserRoles=async(req,res)=>{
    try{
        const data=await userRoleService.getUserRoles(req.params.userId);
        return res.status(200).json({message:"User roles",data});
    }
    catch(error){
        return handleError(res,error,"Get user roles");
    }
};

// POST /user-role/:userId   body: {roles:["admin"]}
const addRoles=async(req,res)=>{
    try{
        const data=await userRoleService.addRoles(req.params.userId,(req.body || {}).roles);
        return res.status(200).json({message:"Roles added",data});
    }
    catch(error){
        return handleError(res,error,"Add roles");
    }
};

// PUT /user-role/:userId   body: {roles:["user"]}
const setRoles=async(req,res)=>{
    try{
        const data=await userRoleService.setRoles(req.params.userId,(req.body || {}).roles);
        return res.status(200).json({message:"Roles updated",data});
    }
    catch(error){
        return handleError(res,error,"Set roles");
    }
};

// DELETE /user-role/:userId/:code
const removeRole=async(req,res)=>{
    try{
        const data=await userRoleService.removeRole(req.params.userId,req.params.code);
        return res.status(200).json({message:"Role removed",data});
    }
    catch(error){
        return handleError(res,error,"Remove role");
    }
};

module.exports={getUserRoles,addRoles,setRoles,removeRole};
