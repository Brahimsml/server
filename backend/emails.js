/*
  Order emails (confirmation + status updates).

  Built like real store emails: table layout and inline styles, because
  Gmail/Outlook ignore most modern CSS. Product photos and the logo are
  attached as inline images (cid:), so they show in every email app even
  though the shop's image server isn't public.
*/
const fs = require("fs");
const path = require("path");

const BRAND = "MegaTech";
const PHONE = "70 123 456";
const LOGO_PATH = path.join(__dirname, "assets", "email-logo.png");

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const money = (n) => Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

const longDate = (value) => {
  const d = new Date(value || Date.now());
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

// What each email says
const COPY = {
  confirmation: {
    eyebrow: "Order confirmed",
    title: (name) => `Thanks for your order, ${name}!`,
    message: "We've received your order and our team will start preparing it. We'll email you whenever its status changes.",
    subject: (id) => `Your ${BRAND} order #${id} is confirmed`,
  },
  pending: {
    eyebrow: "Order update",
    title: () => "Your order is pending",
    message: "We've received your order and it's waiting to be processed by our team.",
    subject: (id) => `Your ${BRAND} order #${id} is pending`,
  },
  processing: {
    eyebrow: "Order update",
    title: () => "We're preparing your order",
    message: "Good news! Our team is preparing your order now. We'll let you know as soon as it's completed.",
    subject: (id) => `We're preparing your ${BRAND} order #${id}`,
  },
  done: {
    eyebrow: "Order completed",
    title: () => "Your order is complete",
    message: `Your order has been completed. Thank you for shopping with ${BRAND}, we hope you enjoy your new gear!`,
    subject: (id) => `Your ${BRAND} order #${id} is complete`,
  },
  cancelled: {
    eyebrow: "Order cancelled",
    title: () => "Your order was cancelled",
    message: "Your order has been cancelled. If you didn't expect this or have any questions, please contact us and we'll help.",
    subject: (id) => `Your ${BRAND} order #${id} was cancelled`,
  },
};

const STATUS_STYLE = {
  pending: { label: "Pending", color: "#9a6a12", bg: "#fdf3dc" },
  processing: { label: "Processing", color: "#1f5fa8", bg: "#e3eefb" },
  done: { label: "Completed", color: "#17794a", bg: "#ddf5e8" },
  cancelled: { label: "Cancelled", color: "#b13a32", bg: "#fbe4e2" },
};

const FONT = "'Segoe UI', Helvetica, Arial, sans-serif";

/*
  order:  { id, customer_name, customer_phone, customer_address, total, created_at, status }
  items:  [{ name, price, qty, image }]   image = file name in imagesDir
  kind:   "confirmation" or a status ("pending" | "processing" | "done" | "cancelled")
  Returns { subject, html, text, attachments } ready for nodemailer.
*/
function buildOrderEmail({ kind, order, items, siteUrl, imagesDir }) {
  const copy = COPY[kind] || COPY.pending;
  const statusKey = kind === "confirmation" ? "pending" : kind;
  const status = STATUS_STYLE[statusKey] || STATUS_STYLE.pending;
  // "ibrahim" -> "Ibrahim" for the greeting
  const rawFirst = String(order.customer_name || "").trim().split(/\s+/)[0] || "there";
  const firstName = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1);
  const orderUrl = `${String(siteUrl || "").replace(/\/$/, "")}/my-orders/${order.id}`;

  // ----- inline images (logo + one per product photo) -----
  const attachments = [];
  if (fs.existsSync(LOGO_PATH)) {
    attachments.push({ filename: "megatech-logo.png", path: LOGO_PATH, cid: "logo@megatech" });
  }
  const cidFor = {};
  items.forEach((it, i) => {
    if (!it.image || /^https?:/i.test(it.image)) return;
    const file = path.basename(it.image); // never read outside the images folder
    const full = path.join(imagesDir, file);
    if (!cidFor[file] && fs.existsSync(full)) {
      cidFor[file] = `item${i}@megatech`;
      attachments.push({ filename: file, path: full, cid: cidFor[file] });
    }
  });
  const photoFor = (it) => {
    if (it.image && /^https?:/i.test(it.image)) return it.image;
    const file = it.image ? path.basename(it.image) : "";
    return cidFor[file] ? `cid:${cidFor[file]}` : null;
  };

  const subtotal = items.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
  const itemCount = items.reduce((s, it) => s + Number(it.qty), 0);

  // ----- items -----
  const itemRows = items
    .map((it) => {
      const photo = photoFor(it);
      const img = photo
        ? `<img src="${photo}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;object-fit:contain;border-radius:10px;background:#ffffff;">`
        : `<div style="width:64px;height:64px;border-radius:10px;background:#f1ede4;color:#a3978a;font:600 22px ${FONT};line-height:64px;text-align:center;">${escapeHtml(String(it.name || "?").trim().charAt(0))}</div>`;
      return `
        <tr>
          <td width="76" valign="top" style="padding:14px 12px 14px 0;border-bottom:1px solid #efe9de;">
            <div style="border:1px solid #ece6da;border-radius:12px;padding:5px;background:#ffffff;width:64px;">${img}</div>
          </td>
          <td valign="middle" style="padding:14px 0;border-bottom:1px solid #efe9de;font-family:${FONT};">
            <div style="font-size:15px;font-weight:600;color:#1c1a16;line-height:1.35;">${escapeHtml(String(it.name).trim())}</div>
            <div style="font-size:13px;color:#7a7266;margin-top:4px;">Qty ${Number(it.qty)} &times; ${money(it.price)}</div>
          </td>
          <td valign="middle" align="right" style="padding:14px 0 14px 12px;border-bottom:1px solid #efe9de;font-family:${FONT};font-size:15px;font-weight:600;color:#1c1a16;white-space:nowrap;">
            ${money(Number(it.price) * Number(it.qty))}
          </td>
        </tr>`;
    })
    .join("");

  const preheader =
    kind === "confirmation"
      ? `Order #${order.id} · ${itemCount} ${itemCount === 1 ? "item" : "items"} · ${money(order.total)}`
      : `Order #${order.id} is now ${status.label.toLowerCase()}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(copy.subject(order.id))}</title>
</head>
<body style="margin:0;padding:0;background:#f4f1ea;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f4f1ea;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e7e2d8;">

          <!-- Header -->
          <tr>
            <td style="background:#14110b;padding:20px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="padding-right:12px;">
                  <img src="cid:logo@megatech" width="40" height="40" alt="${BRAND}" style="display:block;border-radius:10px;border:1px solid #5a4723;">
                </td>
                <td style="font-family:${FONT};font-size:20px;font-weight:700;color:#f6f1e7;letter-spacing:-0.2px;">${BRAND}</td>
              </tr></table>
            </td>
          </tr>
          <tr><td style="height:4px;background:linear-gradient(90deg,#e6c372,#c9a24d);background-color:#c9a24d;font-size:0;line-height:0;">&nbsp;</td></tr>

          <!-- Title -->
          <tr>
            <td style="padding:34px 28px 6px;font-family:${FONT};">
              <div style="font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#a07a2c;">${escapeHtml(copy.eyebrow)}</div>
              <h1 style="margin:10px 0 10px;font-size:26px;line-height:1.25;color:#1c1a16;font-weight:700;">${escapeHtml(copy.title(firstName))}</h1>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#5c554a;">${escapeHtml(copy.message)}</p>
            </td>
          </tr>

          <!-- Order summary -->
          <tr>
            <td style="padding:22px 28px 6px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f3;border:1px solid #efe9de;border-radius:14px;">
                <tr>
                  <td style="padding:16px 18px;font-family:${FONT};">
                    <div style="font-size:12px;color:#8a8275;">Order</div>
                    <div style="font-size:16px;font-weight:700;color:#1c1a16;margin-top:3px;">#${Number(order.id)}</div>
                  </td>
                  <td style="padding:16px 18px;font-family:${FONT};">
                    <div style="font-size:12px;color:#8a8275;">Date</div>
                    <div style="font-size:15px;font-weight:600;color:#1c1a16;margin-top:3px;">${escapeHtml(longDate(order.created_at))}</div>
                  </td>
                  <td align="right" style="padding:16px 18px;font-family:${FONT};">
                    <span style="display:inline-block;padding:5px 12px;border-radius:999px;background:${status.bg};color:${status.color};font-size:13px;font-weight:700;">${status.label}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Items -->
          <tr>
            <td style="padding:24px 28px 0;font-family:${FONT};">
              <div style="font-size:16px;font-weight:700;color:#1c1a16;margin-bottom:4px;">Your items</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${itemRows}
              </table>
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding:16px 28px 4px;font-family:${FONT};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:4px 0;font-size:14px;color:#7a7266;">Subtotal (${itemCount} ${itemCount === 1 ? "item" : "items"})</td>
                  <td align="right" style="padding:4px 0;font-size:14px;color:#3d3830;">${money(subtotal)}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0 4px;font-size:17px;font-weight:700;color:#1c1a16;border-top:1px solid #efe9de;">Total</td>
                  <td align="right" style="padding:12px 0 4px;font-size:20px;font-weight:700;color:#1c1a16;border-top:1px solid #efe9de;">${money(order.total)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Delivery -->
          <tr>
            <td style="padding:24px 28px 0;font-family:${FONT};">
              <div style="font-size:16px;font-weight:700;color:#1c1a16;margin-bottom:10px;">Delivery details</div>
              <div style="font-size:14px;line-height:1.7;color:#3d3830;">
                ${escapeHtml(order.customer_name)}<br>
                ${escapeHtml(order.customer_phone)}<br>
                ${escapeHtml(order.customer_address)}
              </div>
            </td>
          </tr>

          <!-- Button -->
          <tr>
            <td align="center" style="padding:30px 28px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td align="center" style="border-radius:12px;background:#c9a24d;">
                  <a href="${escapeHtml(orderUrl)}" style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:15px;font-weight:700;color:#1c1408;text-decoration:none;border-radius:12px;">View your order</a>
                </td>
              </tr></table>
            </td>
          </tr>

          <!-- Help -->
          <tr>
            <td style="padding:18px 28px 30px;font-family:${FONT};font-size:13px;line-height:1.6;color:#7a7266;text-align:center;">
              Questions about your order? Just reply to this email or call us at <strong style="color:#3d3830;">${PHONE}</strong>.
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">
          <tr>
            <td style="padding:18px 20px;font-family:${FONT};font-size:12px;line-height:1.6;color:#9a917f;text-align:center;">
              &copy; ${new Date().getFullYear()} ${BRAND} &middot; Lebanon<br>
              You're receiving this email because you placed an order at ${BRAND}.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Plain-text version for email apps that don't show HTML
  const text = [
    copy.title(firstName),
    "",
    copy.message,
    "",
    `Order #${order.id} · ${longDate(order.created_at)} · ${status.label}`,
    "",
    "Your items:",
    ...items.map((it) => `- ${String(it.name).trim()}  x${it.qty}  ${money(Number(it.price) * Number(it.qty))}`),
    "",
    `Total: ${money(order.total)}`,
    "",
    "Delivery details:",
    order.customer_name,
    order.customer_phone,
    order.customer_address,
    "",
    `View your order: ${orderUrl}`,
    "",
    `Questions? Reply to this email or call us at ${PHONE}.`,
    `${BRAND} · Lebanon`,
  ].join("\n");

  return { subject: copy.subject(order.id), html, text, attachments };
}

module.exports = { buildOrderEmail };
