const express=require("express");
const {authenticate}=require("../middleware/middleware");
const controller=require("../controllers/review.controller");

// mergeParams so :productId from the parent mount is available
const router=express.Router({mergeParams:true});

router.get("/",controller.list);                          // public
router.get("/:id",controller.getOne);                     // public
router.post("/",authenticate,controller.create);          // logged-in user
router.put("/:id",authenticate,controller.update);        // owner only
router.delete("/:id",authenticate,controller.remove);     // owner or admin

module.exports=router;
