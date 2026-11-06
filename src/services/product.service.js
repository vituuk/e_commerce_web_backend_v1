const {Op}=require("sequelize");
const {Product,Category}=require("../../models");
const AppError=require("../util/app-error");
const {getPagination,buildPagination,parseBool}=require("../util/paginate");

const categoryInclude={model:Category,as:"category",attributes:["id","name","slug"]};

const checkPrice=(base_price)=>{
    if(base_price!==undefined && (isNaN(base_price) || Number(base_price)<0)){
        throw new AppError(400,"base_price must be a number >= 0");
    }
};

const checkCategory=async(categoryId)=>{
    if(categoryId){
        const category=await Category.findByPk(categoryId);
        if(!category) throw new AppError(400,"Category not found");
    }
};

const findOrFail=async(id,options)=>{
    const product=await Product.findByPk(id,options);
    if(!product) throw new AppError(404,"Product not found");
    return product;
};

// list with pagination; optional filters: categoryId, q (name search)
const list=async(query)=>{
    const {page,limit,offset}=getPagination(query);
    const where={};
    if(query.categoryId) where.categoryId=query.categoryId;
    if(query.q){
        where[Op.or]=[
            {name:{[Op.iLike]:`%${query.q}%`}},
            {slug:{[Op.iLike]:`%${query.q}%`}}
        ];
    }
    const active=parseBool(query.is_active);
    if(active!==undefined) where.is_active=active;

    const {rows,count}=await Product.findAndCountAll({
        where,
        include:[categoryInclude],
        order:[["id","ASC"]],
        limit,
        offset,
        distinct:true
    });
    return {rows,pagination:buildPagination(count,page,limit)};
};

const getById=(id)=>findOrFail(id,{include:[categoryInclude]});

const create=async(body)=>{
    const {categoryId,name,slug,description,base_price,is_active}=body;
    if(!name || !slug) throw new AppError(400,"name and slug are required");
    checkPrice(base_price);
    await checkCategory(categoryId);
    const existing=await Product.findOne({where:{slug}});
    if(existing) throw new AppError(409,"Slug already used");
    return Product.create({categoryId,name,slug,description,base_price,is_active});
};

// send only fields to change
const update=async(id,body)=>{
    const product=await findOrFail(id);
    const {categoryId,name,slug,description,base_price,is_active}=body;
    checkPrice(base_price);
    await checkCategory(categoryId);
    if(slug && slug!==product.slug){
        const existing=await Product.findOne({where:{slug}});
        if(existing) throw new AppError(409,"Slug already used");
    }
    if(categoryId!==undefined) product.categoryId=categoryId;
    if(name!==undefined) product.name=name;
    if(slug!==undefined) product.slug=slug;
    if(description!==undefined) product.description=description;
    if(base_price!==undefined) product.base_price=base_price;
    if(is_active!==undefined) product.is_active=is_active;
    await product.save();
    return product;
};

const remove=async(id)=>{
    const product=await findOrFail(id);
    await product.destroy();
};

module.exports={list,getById,create,update,remove};
