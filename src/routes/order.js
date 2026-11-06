const express=require("express");
const {authenticate,authorize}=require("../middleware/middleware");
const controller=require("../controllers/order.controller");
const reportController=require("../controllers/report.controller");

const router=express.Router();

router.use(authenticate);

// admin (declared before /:id so "admin" isn't read as an id)
router.get("/admin/report",authorize("admin"),reportController.report);
router.get("/admin/report/export",authorize("admin"),reportController.reportExport);
router.post("/admin/items",authorize("admin"),controller.createOrderItem);
router.put("/admin/items/:id",authorize("admin"),controller.updateOrderItem);
router.delete("/admin/items/:id",authorize("admin"),controller.removeOrderItem);
router.get("/admin",authorize("admin"),controller.listAll);
router.post("/admin",authorize("admin"),controller.createAdminOrder);
router.get("/admin/:id",authorize("admin"),controller.getAny);
router.patch("/admin/:id/status",authorize("admin"),controller.updateStatus);
router.patch("/admin/:id/pricing",authorize("admin"),controller.updateOrder);
router.patch("/admin/:id",authorize("admin"),controller.updateOrder);
router.put("/admin/:id",authorize("admin"),controller.updateOrder);
router.delete("/admin/:id",authorize("admin"),controller.removeOrder);

// customer (own orders only)
router.post("/",controller.checkout);
router.get("/",controller.listMine);
router.get("/:id/invoice",reportController.invoice); // owner or admin, .docx
router.get("/:id",controller.getMine);
router.patch("/:id/cancel",controller.cancelMine);

module.exports=router;
