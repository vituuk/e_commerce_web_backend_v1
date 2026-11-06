const express=require("express");
const {authenticate,authorize}=require("../middleware/middleware");
const controller=require("../controllers/product-variant.controller");

// mergeParams so :productId from the parent mount is available
const router=express.Router({mergeParams:true});

router.get("/",controller.list);                                          // public
router.get("/:id",controller.getOne);                                     // public
router.post("/",authenticate,authorize("admin"),controller.create);       // admin
router.put("/:id",authenticate,authorize("admin"),controller.update);     // admin
router.delete("/:id",authenticate,authorize("admin"),controller.remove);  // admin

module.exports=router;
