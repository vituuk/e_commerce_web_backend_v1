const express=require("express");
const {authenticate,authorize}=require("../middleware/middleware");
const controller=require("../controllers/address.controller");

const router=express.Router();

// every address route needs a logged-in user
router.use(authenticate);

router.get("/admin",authorize("admin"),controller.listAll);
router.get("/",controller.list);
router.get("/default",controller.getDefault);   // must be before /:id
router.get("/:id",controller.getOne);
router.post("/",controller.create);
router.put("/:id",controller.update);
router.patch("/:id/default",controller.setDefault);
router.delete("/:id",controller.remove);

module.exports=router;
