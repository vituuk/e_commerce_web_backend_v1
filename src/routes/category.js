const express=require("express");
const router=express.Router();
const {authenticate,authorize}=require("../middleware/middleware");
const categoryController=require("../controllers/category.controller");

// GET /category : public, list categories
router.get("/",categoryController.list);
// GET /category/:id : public, one category with its products
router.get("/:id",categoryController.getById);
// POST /category : admin only, create category
router.post("/",authenticate,authorize("admin"),categoryController.create);
// PUT /category/:id : admin only, update category (send only fields to change)
router.put("/:id",authenticate,authorize("admin"),categoryController.update);
// DELETE /category/:id : admin only
// products are kept (their categoryId becomes null)
router.delete("/:id",authenticate,authorize("admin"),categoryController.remove);

module.exports=router;
