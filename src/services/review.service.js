const {Review,Product,User,sequelize}=require("../../models");
const AppError=require("../util/app-error");
const {paginate}=require("../util/paginate");

const userInclude={model:User,as:"user",attributes:["id","firstName","lastName"]};

const isAdminUser=(user)=>{
    const roles=(user && user.roles) || [];
    return roles.includes("admin") || roles.includes("superadmin");
};

// partial=true for update (only check fields that were sent)
const validate=(body,partial)=>{
    const {rating,comment}=body;
    if(!partial || rating!==undefined){
        const r=Number(rating);
        if(!Number.isInteger(r) || r<1 || r>5) return "rating must be an integer from 1 to 5";
    }
    if(comment!==undefined && comment!==null && typeof comment!=="string") return "comment must be a string";
    if(typeof comment==="string" && comment.length>2000) return "comment must be at most 2000 characters";
    return null;
};

const ensureProduct=async(productId)=>{
    const product=await Product.findByPk(productId,{attributes:["id","name","slug"]});
    if(!product) throw new AppError(404,"Product not found");
    return product;
};

const findReview=async(productId,id)=>{
    const review=await Review.findOne({where:{id,productId},include:[userInclude]});
    if(!review) throw new AppError(404,"Review not found");
    return review;
};

// average rating + count per star
const getSummary=async(productId)=>{
    const rows=await Review.findAll({
        where:{productId},
        attributes:["rating",[sequelize.fn("COUNT",sequelize.col("id")),"count"]],
        group:["rating"],
        raw:true
    });
    const breakdown={1:0,2:0,3:0,4:0,5:0};
    let total=0,sum=0;
    rows.forEach(r=>{
        const c=Number(r.count);
        breakdown[r.rating]=c;
        total+=c;
        sum+=r.rating*c;
    });
    return {average_rating:total ? +(sum/total).toFixed(1) : 0,total_reviews:total,breakdown};
};

// ?rating=5&page=1&limit=10  (summary always covers all reviews)
const listByProduct=async(productId,query={})=>{
    const product=await ensureProduct(productId);
    const where={productId};
    if(query.rating!==undefined){
        const r=Number(query.rating);
        if(!Number.isInteger(r) || r<1 || r>5) throw new AppError(400,"rating must be an integer from 1 to 5");
        where.rating=r;
    }
    const {rows,pagination}=await paginate(Review,{
        where,
        include:[userInclude],
        order:[["createdAt","DESC"]]
    },query);
    const summary=await getSummary(productId);
    return {data:{product,...summary,reviews:rows},pagination};
};

const getOne=async(productId,id)=>findReview(productId,id);

const create=async(user,productId,body)=>{
    await ensureProduct(productId);
    const error=validate(body,false);
    if(error) throw new AppError(400,error);

    const callerId=typeof user==="object" ? user.id : user;
    let targetUserId=callerId;
    if(isAdminUser(user) && body.userId){
        const u=await User.findByPk(body.userId);
        if(u) targetUserId=u.id;
    }

    try{
        const existing=await Review.findOne({where:{userId:targetUserId,productId}});
        if(existing && isAdminUser(user)){
            existing.rating=Number(body.rating);
            existing.comment=body.comment ?? null;
            await existing.save();
            return findReview(productId,existing.id);
        }
        const review=await Review.create({
            userId:targetUserId,
            productId,
            rating:Number(body.rating),
            comment:body.comment ?? null
        });
        return findReview(productId,review.id);
    }
    catch(err){
        if(err.name==="SequelizeUniqueConstraintError") throw new AppError(409,"You already reviewed this product, use PUT to update");
        throw err;
    }
};

// owner or admin/superadmin can edit
const update=async(user,productId,id,body)=>{
    const review=await findReview(productId,id);
    const isAdmin=isAdminUser(user);
    if(review.userId!==user.id && !isAdmin) throw new AppError(403,"You can only edit your own review");

    const error=validate(body,true);
    if(error) throw new AppError(400,error);

    if(body.rating!==undefined) review.rating=Number(body.rating);
    if(body.comment!==undefined) review.comment=body.comment;
    await review.save();
    return review;
};

// owner or admin/superadmin can delete
const remove=async(user,productId,id)=>{
    const review=await findReview(productId,id);
    const isAdmin=isAdminUser(user);
    if(review.userId!==user.id && !isAdmin) throw new AppError(403,"You can only delete your own review");
    await review.destroy();
};

module.exports={listByProduct,getOne,create,update,remove};
