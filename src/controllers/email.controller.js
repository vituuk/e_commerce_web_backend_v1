const emailService = require("../services/email.service");

const getConfig = (req, res) => {
    const config = emailService.getEmailConfig();
    return res.status(200).json({
        message: "Email configuration",
        data: {
            configured: config.configured,
            hasApiKey: Boolean(config.apiKey),
            apiKeyMasked: config.apiKey
                ? `${config.apiKey.slice(0, 6)}...${config.apiKey.slice(-4)}`
                : null,
            notificationEmail: config.notificationEmail || null,
            fromEmail: config.fromEmail,
        },
    });
};

const sendTest = async (req, res) => {
    try {
        const result = await emailService.sendTestEmail();
        if (result.success) {
            return res.status(200).json({
                message: "Test email sent successfully via Resend!",
                data: result,
            });
        }
        return res.status(400).json({
            message: result.error || "Failed to send test email",
            data: result,
        });
    } catch (err) {
        return res.status(500).json({
            message: err.message || "Failed to send test email",
        });
    }
};

module.exports = {
    getConfig,
    sendTest,
};

