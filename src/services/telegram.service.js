const fs = require("fs");
const path = require("path");
const { User, Order, OrderItem } = require("../../models");

const ENV_PATH = path.resolve(__dirname, "../../.env");

// Helper to escape HTML characters so dynamic text doesn't break Telegram HTML parse_mode
const escapeHtml = (val) => {
    if (val === undefined || val === null) return "";
    return String(val)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
};

const formatMoney = (val) => `$${Number(val || 0).toFixed(2)}`;

const maskToken = (token) => {
    if (!token) return "";
    const trimmed = String(token).trim();
    if (trimmed.length <= 10) return "******";
    return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
};

const getConfig = () => {
    const botToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
    const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim();
    return {
        configured: Boolean(botToken && chatId),
        hasBotToken: Boolean(botToken),
        hasChatId: Boolean(chatId),
        botTokenMasked: maskToken(botToken),
        chatId: chatId || null
    };
};

const updateConfig = ({ botToken, chatId }) => {
    if (botToken !== undefined) {
        process.env.TELEGRAM_BOT_TOKEN = String(botToken || "").trim();
    }
    if (chatId !== undefined) {
        process.env.TELEGRAM_CHAT_ID = String(chatId || "").trim();
    }

    try {
        let envContent = "";
        if (fs.existsSync(ENV_PATH)) {
            envContent = fs.readFileSync(ENV_PATH, "utf8");
        }

        const lines = envContent.split(/\r?\n/);
        let hasBotTokenLine = false;
        let hasChatIdLine = false;

        const updatedLines = lines.map((line) => {
            if (/^\s*TELEGRAM_BOT_TOKEN\s*=/.test(line)) {
                hasBotTokenLine = true;
                return `TELEGRAM_BOT_TOKEN=${process.env.TELEGRAM_BOT_TOKEN || ""}`;
            }
            if (/^\s*TELEGRAM_CHAT_ID\s*=/.test(line)) {
                hasChatIdLine = true;
                return `TELEGRAM_CHAT_ID=${process.env.TELEGRAM_CHAT_ID || ""}`;
            }
            return line;
        });

        if (!hasBotTokenLine) {
            updatedLines.push(`TELEGRAM_BOT_TOKEN=${process.env.TELEGRAM_BOT_TOKEN || ""}`);
        }
        if (!hasChatIdLine) {
            updatedLines.push(`TELEGRAM_CHAT_ID=${process.env.TELEGRAM_CHAT_ID || ""}`);
        }

        fs.writeFileSync(ENV_PATH, updatedLines.join("\n"), "utf8");
    } catch (err) {
        console.warn("[Telegram] Could not persist config to .env:", err.message);
    }

    return getConfig();
};

const sendTelegramMessage = async (htmlText, options = {}) => {
    const botToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
    const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim();

    if (!botToken || !chatId) {
        console.warn("[Telegram] Notification skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured in .env");
        return {
            success: false,
            skipped: true,
            message: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured in admin/.env"
        };
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const payload = {
        chat_id: chatId,
        text: htmlText,
        parse_mode: options.parse_mode || "HTML",
        disable_web_page_preview: true
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000)
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            const errorDescription = data.description || response.statusText || "Telegram API error";
            console.error(`[Telegram] Failed to send message: ${errorDescription}`);
            return { success: false, error: errorDescription, status: response.status };
        }

        console.log(`[Telegram] Message sent successfully to chat ${chatId}`);
        return { success: true, messageId: data.result?.message_id };
    } catch (err) {
        console.error(`[Telegram] Network error sending message: ${err.message}`);
        return { success: false, error: err.message };
    }
};

const notifyOrderPlaced = async (order, customer = null, options = {}) => {
    try {
        let fullOrder = order;
        if (!fullOrder.items || !fullOrder.items.length) {
            const dbOrder = await Order.findByPk(order.id, {
                include: [{ model: OrderItem, as: "items" }]
            });
            if (dbOrder) fullOrder = dbOrder;
        }

        let dbCustomer = customer;
        if ((!dbCustomer || !dbCustomer.email) && fullOrder.userId) {
            dbCustomer = await User.findByPk(fullOrder.userId, {
                attributes: ["firstName", "lastName", "email"]
            });
        }

        const customerName = [
            dbCustomer?.firstName,
            dbCustomer?.lastName
        ].filter(Boolean).join(" ").trim() ||
            fullOrder.shipping_receiver_name ||
            (dbCustomer?.email ? dbCustomer.email.split("@")[0] : "") ||
            "Customer";

        const customerEmail = dbCustomer?.email || "N/A";
        const customerPhone = fullOrder.shipping_phone || "N/A";
        const deliveryAddress = [
            fullOrder.shipping_street,
            fullOrder.shipping_city
        ].filter(Boolean).join(", ") || "Standard Shipping Address";

        const items = fullOrder.items || [];
        let itemsList = "";
        if (items.length > 0) {
            itemsList = items.map((item) => {
                const name = escapeHtml(item.product_name || "Item");
                const variantParts = [item.color, item.size].filter(Boolean);
                const variantText = variantParts.length ? ` (<i>${escapeHtml(variantParts.join(" / "))}</i>)` : "";
                const qty = item.quantity || 1;
                const unitPrice = formatMoney(item.unit_price || item.amount);
                const lineTotal = formatMoney((Number(item.unit_price || item.amount || 0) * qty));
                return `▫️ <b>${name}</b>${variantText}\n   └ Qty: <b>${qty}</b> × ${unitPrice} = <b>${lineTotal}</b>`;
            }).join("\n");
        } else {
            itemsList = "▫️ <i>Standard checkout package</i>";
        }

        const now = new Date();
        const dateStr = now.toLocaleString("en-US", {
            timeZone: "Asia/Phnom_Penh",
            dateStyle: "medium",
            timeStyle: "short"
        });

        const statusTag = String(fullOrder.status || "pending").toUpperCase();
        const isPaid = statusTag === "PAID" || statusTag === "COMPLETED";
        const statusBadge = isPaid ? "🟢 <b>PAID</b>" : "⏳ <b>PENDING PAYMENT</b>";

        const subtotal = formatMoney(fullOrder.sub_total || fullOrder.total);
        const discountVal = Number(fullOrder.discount || 0);
        const shippingFee = Number(fullOrder.shipping_fee || 0);
        const shippingStr = shippingFee === 0 ? "Free" : formatMoney(shippingFee);
        const total = formatMoney(fullOrder.total);

        const customerDetails = [
            `<b>Name:</b> ${escapeHtml(customerName)}`,
            customerEmail && customerEmail !== "N/A" ? `<b>Email:</b> ${escapeHtml(customerEmail)}` : null,
            customerPhone && customerPhone !== "N/A" ? `<b>Phone:</b> <code>${escapeHtml(customerPhone)}</code>` : null,
            `<b>Address:</b> ${escapeHtml(deliveryAddress)}`
        ].filter(Boolean).join("\n");

        const paymentBreakdown = [
            `Subtotal: <b>${subtotal}</b>`,
            discountVal > 0 ? `Discount: <b>-${formatMoney(discountVal)}</b>` : null,
            `Shipping: <b>${shippingStr}</b>`,
            `────────────────────`,
            `💰 <b>TOTAL:</b> <b>${total} USD</b>`
        ].filter(Boolean).join("\n");

        const message = [
            `🛍️ <b>NEW ORDER RECEIVED!</b>`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `📦 <b>Order ID:</b> <code>#${escapeHtml(fullOrder.order_number || fullOrder.id)}</code>`,
            `⚡ <b>Status:</b> ${statusBadge}`,
            `⏰ <b>Date:</b> ${dateStr}`,
            ``,
            `👤 <b>CUSTOMER &amp; DELIVERY</b>`,
            `<blockquote>${customerDetails}</blockquote>`,
            ``,
            `🛒 <b>ITEMS ORDERED (${items.length || 1})</b>`,
            `<blockquote>${itemsList}</blockquote>`,
            ``,
            `💳 <b>PAYMENT SUMMARY</b>`,
            `<blockquote>${paymentBreakdown}</blockquote>`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `🌐 <i>AURA Clothes Storefront • CommerceOS</i>`
        ].join("\n");

        return await sendTelegramMessage(message);
    } catch (err) {
        console.error("[Telegram] Error composing order notification:", err);
        return { success: false, error: err.message };
    }
};

const notifyPaymentSuccess = async (payment, order = null, customer = null) => {
    try {
        let dbOrder = order;
        if (!dbOrder && payment.orderId) {
            dbOrder = await Order.findByPk(payment.orderId);
        }

        let dbCustomer = customer;
        const targetUserId = payment.userId || dbOrder?.userId;
        if ((!dbCustomer || !dbCustomer.email) && targetUserId) {
            dbCustomer = await User.findByPk(targetUserId, {
                attributes: ["firstName", "lastName", "email"]
            });
        }

        const customerName = [
            dbCustomer?.firstName,
            dbCustomer?.lastName
        ].filter(Boolean).join(" ").trim() ||
            dbOrder?.shipping_receiver_name ||
            (dbCustomer?.email ? dbCustomer.email.split("@")[0] : "") ||
            "Customer";

        const customerEmail = dbCustomer?.email || "N/A";
        const orderNumber = dbOrder?.order_number || payment.orderId || "N/A";
        const tranId = payment.paywayTranId || payment.id || "N/A";
        const method = (payment.method || "ABA PayWay KHQR").toUpperCase();

        const now = new Date();
        const dateStr = now.toLocaleString("en-US", {
            timeZone: "Asia/Phnom_Penh",
            dateStyle: "medium",
            timeStyle: "short"
        });

        const totalPaid = formatMoney(payment.amount || dbOrder?.total);

        const paymentInfo = [
            `<b>Customer:</b> ${escapeHtml(customerName)}`,
            customerEmail && customerEmail !== "N/A" ? `<b>Email:</b> ${escapeHtml(customerEmail)}` : null,
            `<b>Method:</b> ${escapeHtml(method)}`,
            `<b>Txn ID:</b> <code>${escapeHtml(tranId)}</code>`
        ].filter(Boolean).join("\n");

        const settlementInfo = [
            `<b>Amount Paid:</b> <b>${totalPaid} USD</b>`,
            `<b>Status:</b> 🟢 <b>VERIFIED &amp; SETTLED</b>`
        ].join("\n");

        const message = [
            `✅ <b>PAYMENT CONFIRMED!</b>`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `📦 <b>Order ID:</b> <code>#${escapeHtml(orderNumber)}</code>`,
            `⏰ <b>Paid At:</b> ${dateStr}`,
            ``,
            `👤 <b>TRANSACTION DETAILS</b>`,
            `<blockquote>${paymentInfo}</blockquote>`,
            ``,
            `💰 <b>SETTLEMENT SUMMARY</b>`,
            `<blockquote>${settlementInfo}</blockquote>`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `🎉 <i>Order is marked as PAID and ready for fulfillment!</i>`
        ].join("\n");

        return await sendTelegramMessage(message);
    } catch (err) {
        console.error("[Telegram] Error composing payment notification:", err);
        return { success: false, error: err.message };
    }
};

const testTelegramNotification = async () => {
    const now = new Date();
    const dateStr = now.toLocaleString("en-US", {
        timeZone: "Asia/Phnom_Penh",
        dateStyle: "medium",
        timeStyle: "short"
    });

    const config = getConfig();

    const integrationInfo = [
        `<b>Bot Connection:</b> 🟢 <b>Active</b>`,
        `<b>Target Chat ID:</b> <code>${escapeHtml(config.chatId || "Configured")}</code>`,
        `<b>Channel:</b> Instant Order &amp; Payment Webhooks`
    ].join("\n");

    const automations = [
        `▫️ <b>Order Alerts:</b> Customer info, item list &amp; address`,
        `▫️ <b>Payment Alerts:</b> Real-time ABA KHQR &amp; card confirmations`,
        `▫️ <b>Format:</b> High-contrast structured cards &amp; breakdown`
    ].join("\n");

    const message = [
        `🤖 <b>TELEGRAM BOT TEST ALERT</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `⚡ <b>System Status:</b> 🟢 <b>ONLINE</b>`,
        `⏰ <b>Test Time:</b> ${dateStr}`,
        ``,
        `📡 <b>INTEGRATION STATUS</b>`,
        `<blockquote>${integrationInfo}</blockquote>`,
        ``,
        `💡 <b>AUTOMATIONS READY</b>`,
        `<blockquote>${automations}</blockquote>`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `🏪 <i>AURA Clothes Storefront • CommerceOS</i>`
    ].join("\n");

    return await sendTelegramMessage(message);
};

module.exports = {
    getConfig,
    updateConfig,
    sendTelegramMessage,
    notifyOrderPlaced,
    notifyPaymentSuccess,
    testTelegramNotification
};

