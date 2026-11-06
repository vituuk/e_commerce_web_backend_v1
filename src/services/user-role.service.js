const {User,Role}=require("../../models");
const AppError=require("../util/app-error");

const findUser=async(userId)=>{
    const user=await User.findByPk(userId,{attributes:{exclude:["password"]}});
    if(!user) throw new AppError(404,"User not found");
    return user;
};

// active roles by code; throws 400 with the unknown codes
const findRoles=async(codes)=>{
    if(!Array.isArray(codes) || codes.length===0){
        throw new AppError(400,"roles must be a non-empty array of role codes");
    }
    codes=[...new Set(codes)];
    const roles=await Role.findAll({where:{code:codes,status:true}});
    if(roles.length!==codes.length){
        const found=roles.map(r=>r.code);
        const error=new AppError(400,"Invalid role(s)");
        error.extra={invalid:codes.filter(c=>!found.includes(c))};
        throw error;
    }
    return roles;
};

const result=async(user)=>{
    const roles=await user.getRoles({attributes:["id","code","name"],joinTableAttributes:[]});
    return {userId:user.id,email:user.email,roles};
};

const getUserRoles=async(userId)=>result(await findUser(userId));

// add roles (keeps existing ones)
const addRoles=async(userId,codes)=>{
    const user=await findUser(userId);
    await user.addRoles(await findRoles(codes));
    return result(user);
};

// replace all roles with the given list
const setRoles=async(userId,codes)=>{
    const user=await findUser(userId);
    await user.setRoles(await findRoles(codes));
    return result(user);
};

// remove one role by code
const removeRole=async(userId,code)=>{
    const user=await findUser(userId);
    const role=await Role.findOne({where:{code}});
    if(!role) throw new AppError(404,"Role not found");
    await user.removeRole(role);
    return result(user);
};

module.exports={getUserRoles,addRoles,setRoles,removeRole};
