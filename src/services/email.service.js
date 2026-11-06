const { User, Order, OrderItem } = require("../../models");

const formatMoney = (val) => `$${Number(val || 0).toFixed(2)}`;

/**
 * Get current Resend configuration from environment variables.
 * Only requires RESEND_API_KEY and NOTIFICATION_EMAIL!
 */
const getEmailConfig = () => {
    const apiKey = (process.env.RESEND_API_KEY || "").trim();
    const notificationEmail = (
        process.env.NOTIFICATION_EMAIL ||
        process.env.ADMIN_NOTIFICATION_EMAIL ||
        ""
    ).trim();
    const fromEmail = (
        process.env.RESEND_FROM ||
        process.env.SMTP_FROM ||
        "CommerceOS Store <onboarding@resend.dev>"
    ).trim();

    return {
        configured: Boolean(apiKey),
        apiKey,
        notificationEmail,
        fromEmail,
    };
};

/**
 * Sends an email using Resend HTTP API.
 * Uses native global fetch (Node.js 18+) so zero extra dependencies are strictly required.
 */
const sendEmail = async ({ to, subject, html, text }) => {
    const config = getEmailConfig();

    if (!config.apiKey) {
        console.warn(
            "[Email] Notification skipped: RESEND_API_KEY is not configured in admin/.env"
        );
        return {
            success: false,
            skipped: true,
            message: "RESEND_API_KEY not configured in admin/.env",
        };
    }

    const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
    if (!recipients.length) {
        console.warn("[Email] Notification skipped: No recipient email address provided");
        return { success: false, skipped: true, message: "No recipient email" };
    }

    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: config.fromEmail,
                to: recipients,
                subject,
                html,
                text,
            }),
            signal: AbortSignal.timeout(12000),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const errorMsg = data?.message || response.statusText || "Resend API error";
            console.error(`[Email] Resend API error (${response.status}):`, errorMsg);
            return { success: false, error: errorMsg, status: response.status };
        }

        console.log(`[Email] Email sent successfully via Resend to [${recipients.join(", ")}] (ID: ${data?.id || "ok"})`);
        return { success: true, id: data?.id };
    } catch (err) {
        console.error(`[Email] Network error sending email via Resend:`, err.message);
        return { success: false, error: err.message };
    }
};

/**
 * Builds a clean, responsive HTML email receipt for an order.
 */
const buildOrderHtmlTemplate = ({
    orderNumber,
    dateStr,
    customerName,
    customerEmail,
    customerPhone,
    deliveryAddress,
    items,
    subtotal,
    discountVal,
    shippingFee,
    total,
    statusText,
    isPaid,
    isAdminAlert = false,
}) => {
    const statusBg = isPaid ? "#dcfce7" : "#fef9c3";
    const statusColor = isPaid ? "#166534" : "#854d0e";
    const statusLabel = isPaid ? "PAID" : "PENDING PAYMENT";

    const itemsRowsHtml = items
        .map((item) => {
            const name = item.product_name || "Product";
            const variantParts = [item.color, item.size].filter(Boolean);
            const variantText = variantParts.length ? ` <span style="color:#64748b; font-size:12px;">(${variantParts.join(" / ")})</span>` : "";
            const qty = item.quantity || 1;
            const unitPrice = formatMoney(item.unit_price || item.amount);
            const lineTotal = formatMoney(Number(item.unit_price || item.amount || 0) * qty);

            return `
        <tr>
          <td style="padding: 12px 10px; border-bottom: 1px solid #edf2f7; color: #1e293b; font-size: 14px;">
            <strong>${name}</strong>${variantText}
            ${item.sku ? `<br><small style="color: #94a3b8; font-family: monospace;">SKU: ${item.sku}</small>` : ""}
          </td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #edf2f7; text-align: center; color: #475569; font-size: 14px;">${qty}</td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #edf2f7; text-align: right; color: #475569; font-size: 14px;">${unitPrice}</td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #edf2f7; text-align: right; color: #0f172a; font-weight: 600; font-size: 14px;">${lineTotal}</td>
        </tr>
      `;
        })
        .join("");

    return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order ${orderNumber}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
    <div style="max-width: 600px; margin: 24px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(15,23,42,0.05);">
      
      <!-- Brand Header -->
      <div style="background: #0f172a; padding: 24px 32px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">
          Commerce<span style="color: #2dd4bf;">OS</span> Store
        </h1>
        <p style="margin: 6px 0 0; color: #94a3b8; font-size: 13px;">
          ${isAdminAlert ? "New Order Notification (Admin Alert)" : "Order Confirmation & Receipt"}
        </p>
      </div>

      <!-- Main Body -->
      <div style="padding: 32px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 1px solid #edf2f7; padding-bottom: 18px;">
          <div>
            <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Order Number</span>
            <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 2px; font-family: monospace;">${orderNumber}</div>
            <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">${dateStr}</div>
          </div>
          <div style="text-align: right;">
            <span style="display: inline-block; background: ${statusBg}; color: ${statusColor}; padding: 4px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
              ${statusLabel}
            </span>
          </div>
        </div>

        <p style="font-size: 15px; color: #334155; line-height: 1.5; margin: 0 0 20px;">
          ${
              isAdminAlert
                  ? `A new order has been placed by <strong>${customerName}</strong> for a total of <strong>${total}</strong>.`
                  : `Hi <strong>${customerName}</strong>, thank you for your order! We have received your purchase and are preparing it for delivery.`
          }
        </p>

        <!-- Customer & Delivery Card -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 24px; font-size: 13px; line-height: 1.6;">
          <strong style="display: block; color: #0f172a; font-size: 13px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.4px;">Delivery Information</strong>
          <div><strong>Recipient:</strong> ${customerName}</div>
          ${customerEmail && customerEmail !== "N/A" ? `<div><strong>Email:</strong> ${customerEmail}</div>` : ""}
          ${customerPhone && customerPhone !== "N/A" ? `<div><strong>Phone:</strong> ${customerPhone}</div>` : ""}
          <div><strong>Shipping Address:</strong> ${deliveryAddress}</div>
        </div>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <thead>
            <tr style="background: #f1f5f9; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; color: #475569;">
              <th style="padding: 10px; text-align: left;">Item</th>
              <th style="padding: 10px; text-align: center;">Qty</th>
              <th style="padding: 10px; text-align: right;">Price</th>
              <th style="padding: 10px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRowsHtml}
          </tbody>
        </table>

        <!-- Pricing Summary -->
        <div style="margin-left: auto; max-width: 260px; font-size: 13.5px; line-height: 1.8;">
          <div style="display: flex; justify-content: space-between; color: #64748b;">
            <span>Subtotal:</span>
            <span>${subtotal}</span>
          </div>
          ${
              discountVal > 0
                  ? `<div style="display: flex; justify-content: space-between; color: #16a34a;">
              <span>Discount:</span>
              <span>-${formatMoney(discountVal)}</span>
            </div>`
                  : ""
          }
          <div style="display: flex; justify-content: space-between; color: #64748b;">
            <span>Shipping:</span>
            <span>${shippingFee === 0 ? "Free" : formatMoney(shippingFee)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; color: #0f172a; border-top: 2px solid #e2e8f0; margin-top: 6px; padding-top: 6px;">
            <span>Total:</span>
            <span>${total}</span>
          </div>
        </div>

      </div>

      <!-- Footer -->
      <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center; font-size: 12px; color: #94a3b8;">
        <p style="margin: 0;">Need help? Reply to this email or visit our store.</p>
        <p style="margin: 6px 0 0;">&copy; ${new Date().getFullYear()} CommerceOS. All rights reserved.</p>
      </div>

    </div>
  </body>
  </html>
  `;
};

/**
 * Notify customer & admin when a new order is placed.
 */
const notifyOrderPlaced = async (order, customer = null) => {
    try {
        let fullOrder = order;
        if (!fullOrder.items || !fullOrder.items.length) {
            const dbOrder = await Order.findByPk(order.id, {
                include: [{ model: OrderItem, as: "items" }],
            });
            if (dbOrder) fullOrder = dbOrder;
        }

        let dbCustomer = customer;
        if ((!dbCustomer || !dbCustomer.email) && fullOrder.userId) {
            dbCustomer = await User.findByPk(fullOrder.userId, {
                attributes: ["firstName", "lastName", "email"],
            });
        }

        const customerName =
            [dbCustomer?.firstName, dbCustomer?.lastName].filter(Boolean).join(" ").trim() ||
            fullOrder.shipping_receiver_name ||
            (dbCustomer?.email ? dbCustomer.email.split("@")[0] : "") ||
            "Valued Customer";

        const customerEmail = dbCustomer?.email || null;
        const customerPhone = fullOrder.shipping_phone || "N/A";
        const deliveryAddress =
            [fullOrder.shipping_street, fullOrder.shipping_city].filter(Boolean).join(", ") ||
            "Standard Delivery Address";

        const items = fullOrder.items || [];
        const orderNumber = fullOrder.order_number || `#ORD-${fullOrder.id}`;

        const now = new Date();
        const dateStr = now.toLocaleString("en-US", {
            timeZone: "Asia/Phnom_Penh",
            dateStyle: "medium",
            timeStyle: "short",
        });

        const statusTag = String(fullOrder.status || "pending").toUpperCase();
        const isPaid = statusTag === "PAID" || statusTag === "COMPLETED";

        const subtotal = formatMoney(fullOrder.sub_total || fullOrder.total);
        const discountVal = Number(fullOrder.discount || 0);
        const shippingFee = Number(fullOrder.shipping_fee || 0);
        const total = formatMoney(fullOrder.total);

        const config = getEmailConfig();
        const emailPromises = [];

        // 1. Send receipt to Customer (if valid email present)
        if (customerEmail && customerEmail.includes("@")) {
            const customerHtml = buildOrderHtmlTemplate({
                orderNumber,
                dateStr,
                customerName,
                customerEmail,
                customerPhone,
                deliveryAddress,
                items,
                subtotal,
                discountVal,
                shippingFee,
                total,
                statusText: statusTag,
                isPaid,
                isAdminAlert: false,
            });

            emailPromises.push(
                sendEmail({
                    to: customerEmail,
                    subject: `Order Confirmation ${orderNumber} - CommerceOS Store`,
                    html: customerHtml,
                    text: `Thank you for your order ${orderNumber}. Total: ${total}. Status: ${statusTag}.`,
                })
            );
        }

        // 2. Send alert to Admin NOTIFICATION_EMAIL
        if (config.notificationEmail && config.notificationEmail !== customerEmail) {
            const adminHtml = buildOrderHtmlTemplate({
                orderNumber,
                dateStr,
                customerName,
                customerEmail: customerEmail || "N/A",
                customerPhone,
                deliveryAddress,
                items,
                subtotal,
                discountVal,
                shippingFee,
                total,
                statusText: statusTag,
                isPaid,
                isAdminAlert: true,
            });

            emailPromises.push(
                sendEmail({
                    to: config.notificationEmail,
                    subject: `[New Order Alert] ${orderNumber} from ${customerName} (${total})`,
                    html: adminHtml,
                    text: `New order ${orderNumber} placed by ${customerName}. Total: ${total}.`,
                })
            );
        }

        const results = await Promise.allSettled(emailPromises);
        return { success: true, count: results.length };
    } catch (err) {
        console.error("[Email] Error in notifyOrderPlaced:", err.message);
        return { success: false, error: err.message };
    }
};

/**
 * Notify customer & admin when ABA PayWay payment is approved / PAID.
 */
const notifyPaymentSuccess = async (payment) => {
    try {
        if (!payment?.orderId) return { success: false, skipped: true };

        const order = await Order.findByPk(payment.orderId, {
            include: [{ model: OrderItem, as: "items" }],
        });
        if (!order) return { success: false, skipped: true };

        const customer = await User.findByPk(order.userId, {
            attributes: ["firstName", "lastName", "email"],
        });

        // Re-use template with isPaid: true
        return notifyOrderPlaced(order, customer);
    } catch (err) {
        console.error("[Email] Error in notifyPaymentSuccess:", err.message);
        return { success: false, error: err.message };
    }
};

/**
 * Send a test email to verify RESEND_API_KEY and NOTIFICATION_EMAIL.
 */
const sendTestEmail = async () => {
    const config = getEmailConfig();
    if (!config.apiKey) {
        throw new Error("RESEND_API_KEY is not configured in admin/.env");
    }
    const targetEmail = config.notificationEmail;
    if (!targetEmail) {
        throw new Error("NOTIFICATION_EMAIL is not configured in admin/.env");
    }

    const testHtml = `
    <div style="font-family: sans-serif; padding: 24px; max-width: 500px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0f172a; margin-top: 0;">🎉 Resend Email Test Successful!</h2>
      <p style="color: #334155; line-height: 1.5;">
        Your email notification service is working properly with <strong>Resend</strong>.
      </p>
      <div style="background: #f1f5f9; padding: 12px; border-radius: 6px; font-size: 13px; color: #475569;">
        <div><strong>Sender:</strong> ${config.fromEmail}</div>
        <div><strong>Recipient:</strong> ${targetEmail}</div>
        <div><strong>Time:</strong> ${new Date().toISOString()}</div>
      </div>
    </div>
  `;

    return sendEmail({
        to: targetEmail,
        subject: "CommerceOS Resend Test Email",
        html: testHtml,
        text: "CommerceOS Resend Test Email was successful!",
    });
};

module.exports = {
    getEmailConfig,
    sendEmail,
    notifyOrderPlaced,
    notifyPaymentSuccess,
    sendTestEmail,
};

