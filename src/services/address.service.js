const {Op}=require("sequelize");
const {Address,User,sequelize}=require("../../models");
const AppError=require("../util/app-error");
const {paginate}=require("../util/paginate");

const TEXT_FIELDS=["receiver_name","phone","street","city"];
const PHONE_REGEX=/^\+?[0-9]{6,15}$/;

const isAdminUser=(user)=>{
    const roles=(user && user.roles) || [];
    return roles.includes("admin") || roles.includes("superadmin");
};

// partial=true for update (only check fields that were sent)
const validate=(body,partial)=>{
    for(const field of TEXT_FIELDS){
        const value=body[field];
        if(!partial || value!==undefined){
            if(value===undefined || value===null || !String(value).trim()) return `${field} is required`;
        }
    }
    if(body.phone!==undefined){
        const cleanedPhone=String(body.phone).replace(/[\s()\-.]/g,"").trim();
        if(!PHONE_REGEX.test(cleanedPhone)) return "phone must be 6-15 digits, optional leading +";
    }
    if(body.status!==undefined && typeof body.status!=="boolean") return "status must be true or false";
    return null;
};

const findAddress=async(user,id,transaction)=>{
    const userId=typeof user==="object" ? user.id : user;
    const where=isAdminUser(user) ? {id} : {id,userId};
    const address=await Address.findOne({where,transaction});
    if(!address) throw new AppError(404,"Address not found");
    return address;
};

// unset default on all other addresses of this user
const clearDefault=(userId,transaction)=>
    Address.update({status:false},{where:{userId,status:true},transaction});

const userInclude={model:User,as:"user",attributes:["id","firstName","lastName","email"]};

// default first, then newest
// ?city=phnom&q=dara&page=1&limit=10  (q matches receiver_name, phone or street)
const list=async(userId,query={})=>{
    const where={userId};
    if(query.city) where.city={[Op.iLike]:`%${query.city}%`};
    if(query.q){
        const like={[Op.iLike]:`%${query.q}%`};
        where[Op.or]=[{receiver_name:like},{phone:like},{street:like}];
    }
    return paginate(Address,{where,include:[userInclude],order:[["status","DESC"],["createdAt","DESC"]]},query);
};

// admin: list all addresses across users
const listAll=async(query={})=>{
    const where={};
    if(query.userId) where.userId=query.userId;
    if(query.city) where.city={[Op.iLike]:`%${query.city}%`};
    if(query.q){
        const like={[Op.iLike]:`%${query.q}%`};
        where[Op.or]=[{receiver_name:like},{phone:like},{street:like}];
    }
    return paginate(Address,{where,include:[userInclude],order:[["id","ASC"]]},query);
};

const getOne=async(user,id)=>findAddress(user,id);

const getDefault=async(userId)=>{
    const address=await Address.findOne({where:{userId,status:true}});
    if(!address) throw new AppError(404,"No default address");
    return address;
};

const create=async(user,body)=>{
    const error=validate(body,false);
    if(error) throw new AppError(400,error);

    const callerId=typeof user==="object" ? user.id : user;
    let targetUserId=callerId;
    if(isAdminUser(user) && body.userId){
        const u=await User.findByPk(body.userId);
        if(u) targetUserId=u.id;
    }

    return sequelize.transaction(async(t)=>{
        // first address is always default
        const count=await Address.count({where:{userId:targetUserId},transaction:t});
        const makeDefault=count===0 || body.status===true;
        if(makeDefault) await clearDefault(targetUserId,t);

        return Address.create({
            userId:targetUserId,
            receiver_name:String(body.receiver_name).trim(),
            phone:String(body.phone).trim(),
            street:String(body.street).trim(),
            city:String(body.city).trim(),
            status:makeDefault
        },{transaction:t});
    });
};

const update=async(user,id,body)=>{
    const error=validate(body,true);
    if(error) throw new AppError(400,error);

    return sequelize.transaction(async(t)=>{
        const address=await findAddress(user,id,t);

        for(const field of TEXT_FIELDS){
            if(body[field]!==undefined) address[field]=String(body[field]).trim();
        }
        if(body.status===true && !address.status){
            await clearDefault(address.userId,t);
            address.status=true;
        } else if(body.status===false && isAdminUser(user)){
            address.status=false;
        }
        await address.save({transaction:t});
        return address;
    });
};

const setDefault=async(user,id)=>sequelize.transaction(async(t)=>{
    const address=await findAddress(user,id,t);
    if(!address.status){
        await clearDefault(address.userId,t);
        address.status=true;
        await address.save({transaction:t});
    }
    return address;
});

// if the default is deleted, the newest remaining address becomes default
const remove=async(user,id)=>sequelize.transaction(async(t)=>{
    const address=await findAddress(user,id,t);
    const ownerId=address.userId;
    const wasDefault=address.status;
    await address.destroy({transaction:t});

    if(wasDefault){
        const next=await Address.findOne({where:{userId:ownerId},order:[["createdAt","DESC"]],transaction:t});
        if(next){
            next.status=true;
            await next.save({transaction:t});
        }
    }
});

module.exports={list,listAll,getOne,getDefault,create,update,setDefault,remove};
