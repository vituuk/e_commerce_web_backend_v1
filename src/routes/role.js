const express=require("express");
const router=express.Router();
const {authenticate,authorize}=require("../middleware/middleware");
const roleController=require("../controllers/role.controller");

// admin / superadmin can manage roles
router.get("/",authenticate,authorize("admin"),roleController.list);
router.get("/:id",authenticate,authorize("admin"),roleController.getById);
router.post("/",authenticate,authorize("admin","superadmin"),roleController.create);
router.put("/:id",authenticate,authorize("admin","superadmin"),roleController.update);
router.delete("/:id",authenticate,authorize("admin","superadmin"),roleController.remove);

module.exports=router;
