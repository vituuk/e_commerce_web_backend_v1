const cartService=require("../services/cart.service");

// AppError -> its status; anything else -> 500 with a generic message
const handleError=(res,error,label)=>{
    if(error.status){
        return res.status(error.status).json({message:error.message});
    }
    console.log(`${label} error`,error);
    return res.status(500).json({message:`${label} failed`});
};

// GET /cart
const getCart=async(req,res)=>{
    try{
        const data=await cartService.getCart(req.user.id);
        return res.status(200).json({message:"Cart",data});
    }
    catch(error){
        return handleError(res,error,"Get cart");
    }
};

// GET /cart/admin
const listAllCarts=async(req,res)=>{
    try{
        const data=await cartService.listAllCarts(req.user.id);
        return res.status(200).json({message:"All carts",data});
    }
    catch(error){
        return handleError(res,error,"Get all carts");
    }
};

// POST /cart/admin
const createCartForUser=async(req,res)=>{
    try{
        const targetUserId=req.body?.userId || req.user.id;
        const data=await cartService.createCartForUser(targetUserId);
        return res.status(201).json({message:"Cart created",data});
    }
    catch(error){
        return handleError(res,error,"Create cart");
    }
};

// PUT /cart/admin/:id
const updateCartById=async(req,res)=>{
    try{
        const data=await cartService.updateCartById(req.params.id,req.body || {});
        return res.status(200).json({message:"Cart updated",data});
    }
    catch(error){
        return handleError(res,error,"Update cart");
    }
};

// DELETE /cart/admin/:id
const deleteCartById=async(req,res)=>{
    try{
        await cartService.deleteCartById(req.params.id);
        return res.status(200).json({message:"Cart deleted"});
    }
    catch(error){
        return handleError(res,error,"Delete cart");
    }
};

// POST /cart/items   body: {variantId, quantity, cartId?}
const addItem=async(req,res)=>{
    try{
        const data=await cartService.addItem(req.user,req.body || {});
        return res.status(201).json({message:"Item added to cart",data});
    }
    catch(error){
        return handleError(res,error,"Add cart item");
    }
};

// PUT /cart/items/:id   body: {quantity}
const updateItem=async(req,res)=>{
    try{
        const data=await cartService.updateItem(req.user,req.params.id,req.body || {});
        return res.status(200).json({message:"Cart item updated",data});
    }
    catch(error){
        return handleError(res,error,"Update cart item");
    }
};

// DELETE /cart/items/:id
const removeItem=async(req,res)=>{
    try{
        const data=await cartService.removeItem(req.user,req.params.id);
        return res.status(200).json({message:"Cart item removed",data});
    }
    catch(error){
        return handleError(res,error,"Remove cart item");
    }
};

// DELETE /cart
const clearCart=async(req,res)=>{
    try{
        const data=await cartService.clearCart(req.user.id);
        return res.status(200).json({message:"Cart cleared",data});
    }
    catch(error){
        return handleError(res,error,"Clear cart");
    }
};

module.exports={getCart,listAllCarts,createCartForUser,updateCartById,deleteCartById,addItem,updateItem,removeItem,clearCart};
