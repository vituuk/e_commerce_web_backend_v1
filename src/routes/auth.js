const express=require("express");
const authController=require("../controllers/auth.controller");
const {authenticate,authorize}=require("../middleware/middleware");

const router=express.Router();

// Public: normal user sign-up & login
router.post("/user/register",authController.register(["user"],"User registered successfully"));
router.post("/user/login",authController.login());
router.get("/google/config",authController.googleConfig);
router.post("/user/google",authController.googleLogin);

// Public: admin login (account must have "admin" or "superadmin" role)
router.post("/admin/login",authController.login("admin"));

// Admin / Superadmin: create admin account (defaults to ["admin","user"], or pass body.roles)
router.post("/admin/register",authenticate,authorize("admin","superadmin"),authController.register(["admin","user"],"Admin registered successfully",true));

// Protected: admin user management
router.get("/getData",authenticate,authorize("admin"),authController.listUsers);
router.put("/users/:id",authenticate,authorize("admin"),authController.updateUser);
router.delete("/users/:id",authenticate,authorize("admin"),authController.removeUser);
router.get("/me",authenticate,authController.me);

module.exports=router;
