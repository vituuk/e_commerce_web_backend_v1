const express = require("express");
const { authenticate, authorize } = require("../middleware/middleware");
const controller = require("../controllers/email.controller");

const router = express.Router();

// GET /email/config : check email configuration status
router.get("/config", controller.getConfig);

// POST /email/test : admin sends test email via Resend
router.post("/test", authenticate, authorize("admin"), controller.sendTest);

module.exports = router;

