const {Product,ProductVariant}=require("../../models");
const AppError=require("../util/app-error");

const DUPLICATE_MESSAGE="SKU already used, or this product already has a variant with the same color + size";

// validate body; partial=true for update (only check fields that were sent)
const validate=(body,partial)=>{
    const {sku,price,stock_qty,is_active}=body;
    if(!partial || sku!==undefined){
        if(!sku || typeof sku!=="string" || !sku.trim()) return "sku is required";
    }
    if(price!==undefined && price!==null){
        if(isNaN(Number(price)) || Number(price)<0) return "price must be a number >= 0 (or null to use product base_price)";
    }
    if(stock_qty!==undefined){
        if(!Number.isInteger(Number(stock_qty)) || Number(stock_qty)<0) return "stock_qty must be an integer >= 0";
    }
    if(is_active!==undefined && typeof is_active!=="boolean") return "is_active must be true or false";
    return null;
};

// add final_price: variant price, or product base_price when null
const withFinalPrice=(variant,basePrice)=>{
    const json=variant.toJSON();
    json.final_price=json.price!==null ? json.price : basePrice;
    return json;
};

// turn DB unique violations into 409
const rethrowUnique=(error)=>{
    if(error.name==="SequelizeUniqueConstraintError") throw new AppError(409,DUPLICATE_MESSAGE);
    throw error;
};

const findVariant=async(productId,id)=>{
    const variant=await ProductVariant.findOne({
        where:{id,productId},
        include:[{model:Product,as:"product",attributes:["id","name","slug","base_price"]}]
    });
    if(!variant) throw new AppError(404,"Variant not found");
    return variant;
};

const listByProduct=async(productId)=>{
    const product=await Product.findByPk(productId,{
        attributes:["id","name","slug","base_price"],
        include:[{model:ProductVariant,as:"variants",attributes:{exclude:["productId"]}}],
        order:[[{model:ProductVariant,as:"variants"},"id","ASC"]]
    });
    if(!product) throw new AppError(404,"Product not found");

    const data=product.toJSON();
    data.variants=product.variants.map(v=>withFinalPrice(v,product.base_price));
    return data;
};

const getOne=async(productId,id)=>{
    const variant=await findVariant(productId,id);
    return withFinalPrice(variant,variant.product.base_price);
};

const create=async(productId,body)=>{
    const product=await Product.findByPk(productId);
    if(!product) throw new AppError(404,"Product not found");

    const error=validate(body,false);
    if(error) throw new AppError(400,error);

    const {sku,color,size,price,stock_qty,is_active}=body;
    try{
        // productId comes from the URL, never from the body
        const variant=await ProductVariant.create({
            productId:product.id,
            sku:sku.trim(),
            color:color ?? null,
            size:size ?? null,
            price:price ?? null,
            stock_qty:stock_qty ?? 0,
            is_active:is_active ?? true
        });
        return withFinalPrice(variant,product.base_price);
    }
    catch(err){
        rethrowUnique(err);
    }
};

const update=async(productId,id,body)=>{
    const variant=await findVariant(productId,id);

    const error=validate(body,true);
    if(error) throw new AppError(400,error);

    const {sku,color,size,price,stock_qty,is_active}=body;
    if(sku!==undefined) variant.sku=sku.trim();
    if(color!==undefined) variant.color=color;
    if(size!==undefined) variant.size=size;
    if(price!==undefined) variant.price=price;
    if(stock_qty!==undefined) variant.stock_qty=stock_qty;
    if(is_active!==undefined) variant.is_active=is_active;

    try{
        await variant.save();
    }
    catch(err){
        rethrowUnique(err);
    }
    return withFinalPrice(variant,variant.product.base_price);
};

const remove=async(productId,id)=>{
    const deleted=await ProductVariant.destroy({where:{id,productId}});
    if(!deleted) throw new AppError(404,"Variant not found");
};

module.exports={listByProduct,getOne,create,update,remove};
