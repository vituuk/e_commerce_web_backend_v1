const {Op}=require("sequelize");
const {Role}=require("../../models");
const AppError=require("../util/app-error");
const {paginate,parseBool}=require("../util/paginate");

const findOrFail=async(id)=>{
    const role=await Role.findByPk(id);
    if(!role) throw new AppError(404,"Role not found");
    return role;
};

// ?q=admin&status=true&page=1&limit=10  (q matches name or code)
const list=(query={})=>{
    const where={};
    if(query.q) where[Op.or]=[{name:{[Op.iLike]:`%${query.q}%`}},{code:{[Op.iLike]:`%${query.q}%`}}];
    const status=parseBool(query.status);
    if(status!==undefined) where.status=status;
    return paginate(Role,{where,order:[["id","ASC"]]},query);
};

const getById=(id)=>findOrFail(id);

const create=async({name,code,status})=>{
    if(!name || !code) throw new AppError(400,"name and code are required");
    const existing=await Role.findOne({where:{code}});
    if(existing) throw new AppError(409,"Role code already used");
    return Role.create({name,code,status:status===undefined ? true : status});
};

// send only fields to change
const update=async(id,{name,code,status})=>{
    const role=await findOrFail(id);
    if(code && code!==role.code){
        const existing=await Role.findOne({where:{code}});
        if(existing) throw new AppError(409,"Role code already used");
    }
    if(name!==undefined) role.name=name;
    if(code!==undefined) role.code=code;
    if(status!==undefined) role.status=status;
    await role.save();
    return role;
};

const remove=async(id)=>{
    const role=await findOrFail(id);
    await role.destroy();
};

module.exports={list,getById,create,update,remove};
