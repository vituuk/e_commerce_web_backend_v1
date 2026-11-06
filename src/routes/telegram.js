const express = require("express");
const { authenticate, authorize } = require("../middleware/middleware");
const controller = require("../controllers/telegram.controller");

const router = express.Router();

// GET /telegram/config : public status check
router.get("/config", controller.getConfig);

// POST /telegram/config : admin updates bot token / chat id
router.post("/config", authenticate, authorize("admin"), controller.updateConfig);

// POST /telegram/test : admin sends an instant test notification
router.post("/test", authenticate, authorize("admin"), controller.testNotification);

module.exports = router;

