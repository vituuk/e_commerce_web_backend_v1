const express=require("express");
const router=express.Router();
const {authenticate,authorize}=require("../middleware/middleware");
const productController=require("../controllers/product.controller");

// GET /product : public, list products with their category
// optional: ?categoryId=1&q=iphone&page=1&limit=10
router.get("/",productController.list);
// GET /product/:id : public, one product with its category
router.get("/:id",productController.getById);
// POST /product : admin only, create product
router.post("/",authenticate,authorize("admin"),productController.create);
// PUT /product/:id : admin only, update product (send only fields to change)
router.put("/:id",authenticate,authorize("admin"),productController.update);
// DELETE /product/:id : admin only
router.delete("/:id",authenticate,authorize("admin"),productController.remove);

module.exports=router;