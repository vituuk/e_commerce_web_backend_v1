const express=require("express");
const router=express.Router();
const {authenticate,authorize}=require("../middleware/middleware");
const userRoleController=require("../controllers/user-role.controller");

// admin / superadmin can view and manage user roles
router.get("/:userId",authenticate,authorize("admin"),userRoleController.getUserRoles);
router.post("/:userId",authenticate,authorize("admin","superadmin"),userRoleController.addRoles);
router.put("/:userId",authenticate,authorize("admin","superadmin"),userRoleController.setRoles);
router.delete("/:userId/:code",authenticate,authorize("admin","superadmin"),userRoleController.removeRole);

module.exports=router;
