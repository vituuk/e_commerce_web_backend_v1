const userService=require("../services/user.service");
const handleError=require("../util/handle-error");
const {User,Role,UserProfile}=require("../../models");

// ---------- handler factories ----------

// Returns a register handler that gives the new account the given roles
// allowBodyRoles: if true, req.body.roles (array of role codes) overrides the default roleCodes
const register=(roleCodes,successMessage,allowBodyRoles=false)=>async(req,res)=>{
    try{
        const data=await userService.register(req.body || {},roleCodes,allowBodyRoles);
        return res.status(201).json({message:successMessage,data});
    }
    catch(error){
        return handleError(res,error,"Register");
    }
};

// Returns a login handler; if requiredRole is given, account must have it
const login=(requiredRole)=>async(req,res)=>{
    try{
        const {token,roles,expiresIn}=await userService.login(req.body || {},requiredRole);
        if(requiredRole==="admin"){
            res.cookie("commerceos_admin_token",token,{
                maxAge:2 * 60 * 60 * 1000,
                httpOnly:false,
                sameSite:"lax",
                path:"/"
            });
        }
        return res.status(200).json({message:"Login successful",token,roles,expiresIn});
    }
    catch(error){
        if(!error.status){
            console.log("login error",error);
            return res.status(500).json({message:"Login error"});
        }
        return handleError(res,error,"Login");
    }
};

// GET /auth/getData : admin only, list users (without passwords)
const listUsers=async(req,res)=>{
    try{
        const data=await userService.listUsers();
        return res.json({message:"Data is finding",data});
    }
    catch(error){
        return handleError(res,error,"Get data");
    }
};

// PUT /auth/users/:id : admin only, update user fields
const updateUser=async(req,res)=>{
    try{
        const data=await userService.updateUser(req.params.id,req.body || {});
        return res.status(200).json({message:"User updated",data});
    }
    catch(error){
        return handleError(res,error,"Update user");
    }
};

// DELETE /auth/users/:id : admin only, delete user
const removeUser=async(req,res)=>{
    try{
        await userService.removeUser(req.params.id);
        return res.status(200).json({message:"User deleted"});
    }
    catch(error){
        return handleError(res,error,"Delete user");
    }
};

// GET /auth/me : live user data from DB with fallback to token
const me=async(req,res)=>{
    try {
        if(!req.user || !req.user.id){
            return res.json({message:"Current user",data:req.user});
        }
        const user=await User.findByPk(req.user.id,{
            attributes:{exclude:["password"]},
            include:[
                {model:Role,attributes:["code","name"],through:{attributes:[]}},
                {model:UserProfile,as:"profile",attributes:{exclude:["userId"]}}
            ]
        });
        if(!user){
            return res.json({message:"Current user",data:req.user});
        }
        const roles=(user.Roles || []).map(r=>r.code);
        const first=(user.firstName || "").trim();
        const last=(user.lastName || "").trim();
        const fullName=`${first} ${last}`.trim() || first || last || (user.email ? user.email.split("@")[0] : "Admin");
        return res.json({
            message:"Current user",
            data:{
                id:user.id,
                email:user.email,
                firstName:user.firstName,
                lastName:user.lastName,
                fullName,
                roles:roles.length ? roles : (req.user.roles || ["admin"]),
                avatar:user.profile ? user.profile.avatar : null,
                profile:user.profile || null
            }
        });
    }
    catch(err){
        return res.json({message:"Current user",data:req.user});
    }
};

// GET /auth/google/config : public OAuth 2.0 Web Client ID for Google Identity Services
const googleConfig=(req,res)=>{
    return res.status(200).json({
        clientId:userService.getGoogleClientId()
    });
};

// POST /auth/user/google : public customer Google Sign-In / Sign-Up
const googleLogin=async(req,res)=>{
    try{
        const result=await userService.googleLogin(req.body || {});
        return res.status(200).json({
            message:"Google login successful",
            ...result
        });
    }
    catch(error){
        return handleError(res,error,"Google Login");
    }
};

module.exports={register,login,googleConfig,googleLogin,listUsers,updateUser,removeUser,me};
