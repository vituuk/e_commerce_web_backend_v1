const express=require("express");
const {authenticate,authorize}=require("../middleware/middleware");
const controller=require("../controllers/cart.controller");

const router=express.Router();

// every cart route needs a logged-in user
router.use(authenticate);

router.get("/admin",authorize("admin"),controller.listAllCarts);
router.post("/admin",authorize("admin"),controller.createCartForUser);
router.put("/admin/:id",authorize("admin"),controller.updateCartById);
router.delete("/admin/:id",authorize("admin"),controller.deleteCartById);

router.get("/",controller.getCart);
router.delete("/",controller.clearCart);
router.post("/items",controller.addItem);
router.put("/items/:id",controller.updateItem);
router.delete("/items/:id",controller.removeItem);

module.exports=router;
