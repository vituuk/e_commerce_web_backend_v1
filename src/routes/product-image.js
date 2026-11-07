const express=require("express");
const {Product,ProductImage,sequelize}=require("../../models");
const {authenticate,authorize}=require("../middleware/middleware");
const {handleUpload,deleteUploadedFile}=require("../middleware/upload");

// multipart sends booleans as strings
const toBool=(v)=>v===true || v==="true" || v==="1" || v==="yes";
const fileUrl=(file)=>file.cloudinaryUrl || `/uploads/products/${file.filename}`;

// mergeParams so :productId from the parent mount is available
const router=express.Router({mergeParams:true});

// GET /product/:productId/images : public, list images of a product
router.get("/",async(req,res)=>{
    try{
        const product=await Product.findByPk(req.params.productId,{
            attributes:["id","name","slug"],
            include:[{model:ProductImage,as:"images",attributes:{exclude:["productId"]}}],
            order:[[{model:ProductImage,as:"images"},"is_primary","DESC"],[{model:ProductImage,as:"images"},"id","ASC"]]
        });
        if(!product){
            return res.status(404).json({message:"Product not found"});
        }
        return res.status(200).json({message:"Product images",data:product});
    }
    catch(error){
        console.log("Get product images error",error);
        return res.status(500).json({message:"Get product images failed"});
    }
});

// GET /product/:productId/images/:id : public, one image with its product
router.get("/:id",async(req,res)=>{
    try{
        const image=await ProductImage.findOne({
            where:{id:req.params.id,productId:req.params.productId},
            include:[{model:Product,as:"product",attributes:["id","name","slug"]}]
        });
        if(!image){
            return res.status(404).json({message:"Image not found"});
        }
        return res.status(200).json({message:"Product image",data:image});
    }
    catch(error){
        console.log("Get product image error",error);
        return res.status(500).json({message:"Get product image failed"});
    }
});

// POST /product/:productId/images : admin only, multipart/form-data { image: file, url?, is_primary? }
router.post("/",authenticate,authorize("admin"),handleUpload,async(req,res)=>{
    const uploadedUrl=req.file ? fileUrl(req.file) : null;
    const directUrl=req.body?.url ? String(req.body.url).trim() : null;
    const url=uploadedUrl || directUrl;
    if(!url){
        return res.status(400).json({message:"image file or url is required"});
    }
    const t=await sequelize.transaction();
    try{
        const product=await Product.findByPk(req.params.productId,{transaction:t});
        if(!product){
            await t.rollback();
            if(uploadedUrl) deleteUploadedFile(uploadedUrl);
            return res.status(404).json({message:"Product not found"});
        }

        // first image becomes primary automatically
        const count=await ProductImage.count({where:{productId:product.id},transaction:t});
        const primary=count===0 ? true : toBool(req.body.is_primary);

        // only one primary per product
        if(primary){
            await ProductImage.update({is_primary:false},{where:{productId:product.id},transaction:t});
        }

        const image=await ProductImage.create({productId:product.id,url,is_primary:primary},{transaction:t});
        await t.commit();
        return res.status(201).json({message:"Image created",data:image});
    }
    catch(error){
        await t.rollback();
        if(uploadedUrl) deleteUploadedFile(uploadedUrl);
        console.log("Create product image error",error);
        return res.status(500).json({message:"Create product image failed"});
    }
});

// PUT /product/:productId/images/:id : admin only, multipart/form-data { productId?, image?: file, url?, is_primary? }
router.put("/:id",authenticate,authorize("admin"),handleUpload,async(req,res)=>{
    const newUrl=req.file ? fileUrl(req.file) : (req.body?.url ? String(req.body.url).trim() : null);
    const rawProductId=req.body?.productId ?? req.body?.product_id;
    const t=await sequelize.transaction();
    try{
        let image=await ProductImage.findOne({
            where:{id:req.params.id,productId:req.params.productId},
            transaction:t
        });
        if(!image && rawProductId!==undefined && String(rawProductId).trim()===String(req.params.productId)){
            image=await ProductImage.findByPk(req.params.id,{transaction:t});
        }
        if(!image){
            await t.rollback();
            if(req.file) deleteUploadedFile(newUrl);
            return res.status(404).json({message:"Image not found"});
        }

        const oldProductId=Number(image.productId);
        const wasPrimaryOnOld=Boolean(image.is_primary);
        let targetProductId=oldProductId;

        if(rawProductId!==undefined && String(rawProductId).trim()!==""){
            const parsedProductId=Number(rawProductId);
            if(!Number.isInteger(parsedProductId) || parsedProductId<=0){
                await t.rollback();
                if(req.file) deleteUploadedFile(newUrl);
                return res.status(400).json({message:"Invalid productId"});
            }
            if(parsedProductId!==oldProductId){
                const targetProduct=await Product.findByPk(parsedProductId,{transaction:t});
                if(!targetProduct){
                    await t.rollback();
                    if(req.file) deleteUploadedFile(newUrl);
                    return res.status(404).json({message:"Product not found"});
                }
                targetProductId=targetProduct.id;
                image.productId=targetProductId;
            }
        }

        const oldUrl=image.url;
        if(newUrl) image.url=newUrl;

        if(req.body?.is_primary!==undefined && String(req.body.is_primary).trim()!==""){
            if(toBool(req.body.is_primary)){
                await ProductImage.update({is_primary:false},{where:{productId:targetProductId},transaction:t});
                image.is_primary=true;
            } else {
                image.is_primary=false;
            }
        } else if(targetProductId!==oldProductId){
            if(image.is_primary){
                await ProductImage.update({is_primary:false},{where:{productId:targetProductId},transaction:t});
            } else {
                const targetCount=await ProductImage.count({where:{productId:targetProductId},transaction:t});
                if(targetCount===0) image.is_primary=true;
            }
        }

        await image.save({transaction:t});

        // promote another image on the old product if its primary image was moved
        if(targetProductId!==oldProductId && wasPrimaryOnOld){
            const next=await ProductImage.findOne({where:{productId:oldProductId},order:[["id","ASC"]],transaction:t});
            if(next){
                next.is_primary=true;
                await next.save({transaction:t});
            }
        }

        await t.commit();

        if(req.file && oldUrl && oldUrl!==newUrl) deleteUploadedFile(oldUrl);
        return res.status(200).json({message:"Image updated",data:image});
    }
    catch(error){
        await t.rollback();
        if(req.file) deleteUploadedFile(newUrl);
        console.log("Update product image error",error);
        return res.status(500).json({message:"Update product image failed"});
    }
});

// DELETE /product/:productId/images/:id : admin only
router.delete("/:id",authenticate,authorize("admin"),async(req,res)=>{
    const t=await sequelize.transaction();
    try{
        const image=await ProductImage.findOne({
            where:{id:req.params.id,productId:req.params.productId},
            transaction:t
        });
        if(!image){
            await t.rollback();
            return res.status(404).json({message:"Image not found"});
        }
        const wasPrimary=image.is_primary;
        await image.destroy({transaction:t});

        // promote another image if the primary was removed
        if(wasPrimary){
            const next=await ProductImage.findOne({where:{productId:image.productId},order:[["id","ASC"]],transaction:t});
            if(next){
                next.is_primary=true;
                await next.save({transaction:t});
            }
        }
        await t.commit();
        deleteUploadedFile(image.url);
        return res.status(200).json({message:"Image deleted"});
    }
    catch(error){
        await t.rollback();
        console.log("Delete product image error",error);
        return res.status(500).json({message:"Delete product image failed"});
    }
});

module.exports=router;
