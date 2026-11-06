const telegramService = require("../services/telegram.service");

const getConfig = (req, res) => {
    try {
        const config = telegramService.getConfig();
        return res.status(200).json({ message: "Telegram configuration", data: config });
    } catch (err) {
        console.error("Get telegram config error:", err);
        return res.status(500).json({ message: "Failed to get Telegram config" });
    }
};

const updateConfig = (req, res) => {
    try {
        const { botToken, chatId } = req.body || {};
        const config = telegramService.updateConfig({ botToken, chatId });
        return res.status(200).json({ message: "Telegram configuration updated", data: config });
    } catch (err) {
        console.error("Update telegram config error:", err);
        return res.status(500).json({ message: "Failed to update Telegram config" });
    }
};

const testNotification = async (req, res) => {
    try {
        const result = await telegramService.testTelegramNotification();
        if (result.success) {
            return res.status(200).json({ message: "Test alert sent to Telegram successfully!", data: result });
        }
        return res.status(400).json({
            message: result.error || result.message || "Could not send test message. Check bot token and chat ID.",
            data: result
        });
    } catch (err) {
        console.error("Test telegram notification error:", err);
        return res.status(500).json({ message: "Failed to send test notification" });
    }
};

module.exports = {
    getConfig,
    updateConfig,
    testNotification
};

