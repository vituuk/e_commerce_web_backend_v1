const express=require("express");
const {authenticate,authorize}=require("../middleware/middleware");
const controller=require("../controllers/payment.controller");

const router=express.Router();

// public: PayWay calls this (may send JSON or form data)
router.post("/callback",express.urlencoded({extended:true}),controller.callback);

// admin
router.get("/admin",authenticate,authorize("admin"),controller.listAll);
router.post("/admin",authenticate,authorize("admin"),controller.createAdminPayment);
router.put("/admin/:id",authenticate,authorize("admin"),controller.updateAdminPayment);
router.delete("/admin/:id",authenticate,authorize("admin"),controller.removeAdminPayment);

// customer
router.post("/checkout",authenticate,controller.checkout);
router.get("/verify/:tranId",authenticate,controller.verify);
router.get("/",authenticate,controller.listMine);

module.exports=router;
