const {Op}=require("sequelize");
const {Category,Product}=require("../../models");
const AppError=require("../util/app-error");
const {paginate,parseBool}=require("../util/paginate");

const findOrFail=async(id,options)=>{
    const category=await Category.findByPk(id,options);
    if(!category) throw new AppError(404,"Category not found");
    return category;
};

// ?q=phone&is_active=true&page=1&limit=10
const list=(query={})=>{
    const where={};
    if(query.q){
        where[Op.or]=[
            {name:{[Op.iLike]:`%${query.q}%`}},
            {slug:{[Op.iLike]:`%${query.q}%`}}
        ];
    }
    const active=parseBool(query.is_active);
    if(active!==undefined) where.is_active=active;
    return paginate(Category,{where,order:[["id","ASC"]]},query);
};

// one category with its products
const getById=(id)=>findOrFail(id,{include:[{model:Product,as:"products"}]});

const create=async(body)=>{
    const {name,slug,is_active}=body;
    if(!name || !slug) throw new AppError(400,"name and slug are required");
    const existing=await Category.findOne({where:{slug}});
    if(existing) throw new AppError(409,"Slug already used");
    return Category.create({name,slug,is_active});
};

// send only fields to change
const update=async(id,body)=>{
    const category=await findOrFail(id);
    const {name,slug,is_active}=body;
    if(slug && slug!==category.slug){
        const existing=await Category.findOne({where:{slug}});
        if(existing) throw new AppError(409,"Slug already used");
    }
    if(name!==undefined) category.name=name;
    if(slug!==undefined) category.slug=slug;
    if(is_active!==undefined) category.is_active=is_active;
    await category.save();
    return category;
};

// products are kept (their categoryId becomes null)
const remove=async(id)=>{
    const category=await findOrFail(id);
    await category.destroy();
};

module.exports={list,getById,create,update,remove};
