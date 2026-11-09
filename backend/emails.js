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

const PAYMENT_LABELS = { cash: "Cash on delivery", card: "Visa card" };

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
    tint: "#ecfdf5",
    icon: "&#10003;",
    accent: "#15803d",
    eyebrow: "Order confirmed",
    title: (name) => `Thanks for your order, ${name}!`,
    message: "We've received your order and our team will start preparing it. We'll email you whenever its status changes.",
    subject: (id) => `Your ${BRAND} order #${id} is confirmed`,
  },
  pending: {
    tint: "#fffbeb",
    icon: "&#8226;&#8226;&#8226;",
    accent: "#b45309",
    eyebrow: "Order update",
    title: () => "Your order is pending",
    message: "We've received your order and it's waiting to be processed by our team.",
    subject: (id) => `Your ${BRAND} order #${id} is pending`,
  },
  processing: {
    tint: "#eff6ff",
    icon: "&#9881;",
    accent: "#1d4ed8",
    eyebrow: "Order update",
    title: () => "We're preparing your order",
    message: "Good news! Our team is preparing your order now. We'll let you know as soon as it's completed.",
    subject: (id) => `We're preparing your ${BRAND} order #${id}`,
  },
  done: {
    tint: "#ecfdf5",
    icon: "&#10003;",
    accent: "#15803d",
    eyebrow: "Order completed",
    title: () => "Your order is complete",
    message: `Your order has been completed. Thank you for shopping with ${BRAND}, we hope you enjoy your new gear!`,
    subject: (id) => `Your ${BRAND} order #${id} is complete`,
  },
  cancelled: {
    tint: "#fef2f2",
    icon: "&#10005;",
    accent: "#b91c1c",
    eyebrow: "Order cancelled",
    title: () => "Your order was cancelled",
    message: "Your order has been cancelled. If you didn't expect this or have any questions, please contact us and we'll help.",
    subject: (id) => `Your ${BRAND} order #${id} was cancelled`,
  },
};

const STATUS_STYLE = {
  pending: { label: "Pending", color: "#9a6a12", bg: "#fdf3dc" },
  processing: { label: "Processing", color: "#1d4ed8", bg: "#dbeafe" },
  done: { label: "Completed", color: "#17794a", bg: "#ddf5e8" },
  cancelled: { label: "Cancelled", color: "#b13a32", bg: "#fbe4e2" },
};

const FONT = "'Segoe UI', Helvetica, Arial, sans-serif";

// Shared frame for every email: black header with the logo, a thin blue-violet line,
// white card, help line, then a footer with links. title/preheader are plain text;
// body/help/footnote are HTML. siteUrl (optional) makes the footer links work.
function emailShell({ title, preheader, body, help, footnote, siteUrl }) {
  const site = String(siteUrl || process.env.SITE_URL || "").split(",")[0].trim().replace(/\/$/, "");
  const link = (href, label) =>
    `<a href="${escapeHtml(href)}" style="color:#6b7280;text-decoration:none;font-weight:600;">${label}</a>`;
  const links = site
    ? `${link(`${site}/shop`, "Shop")} &nbsp;&middot;&nbsp; ${link(`${site}/my-orders`, "My orders")} &nbsp;&middot;&nbsp; ${link(`${site}/contact`, "Help")} &nbsp;&middot;&nbsp; ${link(`${site}/menu`, "Stores")}<br>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#eef0f4;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#eef0f4;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f4;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#000000;padding:22px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td>
                  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                    <td style="padding-right:10px;"><img src="cid:logo@megatech" width="34" height="34" alt="${BRAND}" style="display:block;"></td>
                    <td style="font-family:${FONT};font-size:19px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">${BRAND}</td>
                  </tr></table>
                </td>
                <td align="right" style="font-family:${FONT};font-size:12px;color:#9ca3af;">PC parts &amp; gaming gear</td>
              </tr></table>
            </td>
          </tr>
          <tr><td style="height:3px;background:#2563eb;background-image:linear-gradient(90deg,#2563eb,#7c3aed);font-size:0;line-height:0;">&nbsp;</td></tr>

${body}          <!-- Help -->
          <tr>
            <td style="padding:8px 32px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e8ecf2;border-radius:14px;">
                <tr><td style="padding:16px 20px;font-family:${FONT};font-size:13px;line-height:1.6;color:#4b5563;text-align:center;">${help}</td></tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">
          <tr>
            <td style="padding:22px 20px 8px;font-family:${FONT};font-size:12px;line-height:1.9;color:#9ca3af;text-align:center;">
              ${links}Cash on delivery &middot; Delivery all over Lebanon &middot; 7-day returns<br>
              &copy; ${new Date().getFullYear()} ${BRAND} &middot; Lebanon<br>
              <span style="color:#b6bcc6;">${footnote}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

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
  const deliveryFee = Number(order.delivery_fee || 0);
  const paymentLabel = PAYMENT_LABELS[order.payment_method] || "";

  // ----- items -----
  const itemRows = items
    .map((it) => {
      const photo = photoFor(it);
      const img = photo
        ? `<img src="${photo}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;object-fit:contain;border-radius:10px;background:#ffffff;">`
        : `<div style="width:64px;height:64px;border-radius:10px;background:#f3f4f6;color:#9ca3af;font:600 22px ${FONT};line-height:64px;text-align:center;">${escapeHtml(String(it.name || "?").trim().charAt(0))}</div>`;
      return `
        <tr>
          <td width="76" valign="top" style="padding:14px 12px 14px 0;border-bottom:1px solid #eef2f6;">
            <div style="border:1px solid #e5e7eb;border-radius:12px;padding:5px;background:#ffffff;width:64px;">${img}</div>
          </td>
          <td valign="middle" style="padding:14px 0;border-bottom:1px solid #eef2f6;font-family:${FONT};">
            <div style="font-size:15px;font-weight:600;color:#111111;line-height:1.35;">${escapeHtml(String(it.name).trim())}</div>
            <div style="margin-top:6px;font-size:13px;color:#64748b;"><span style="display:inline-block;padding:2px 8px;border-radius:6px;background:#f1f5f9;color:#334155;font-weight:600;">Qty ${Number(it.qty)}</span> &nbsp;${money(it.price)} each</div>
          </td>
          <td valign="middle" align="right" style="padding:14px 0 14px 12px;border-bottom:1px solid #eef2f6;font-family:${FONT};font-size:15px;font-weight:600;color:#111111;white-space:nowrap;">
            ${money(Number(it.price) * Number(it.qty))}
          </td>
        </tr>`;
    })
    .join("");

  // Progress like big stores: Placed -> Preparing -> Completed (green done, blue now, grey next)
  const stepAt = { confirmation: 0, pending: 0, processing: 1, done: 2 }[kind];
  const tracker =
    stepAt === undefined
      ? ""
      : `
          <!-- Progress -->
          <tr>
            <td style="padding:22px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${["Order placed", "Preparing", "Completed"]
                .map((label, i) => {
                  const done = i < stepAt || (i === stepAt && kind === "done");
                  const now = i === stepAt && kind !== "done";
                  const color = done ? "#16a34a" : now ? "#2563eb" : "#cbd5e1";
                  return `
                <td align="center" width="33%" style="font-family:${FONT};">
                  <div style="height:6px;border-radius:999px;background:${color};"></div>
                  <div style="margin-top:8px;font-size:12px;font-weight:${done || now ? 700 : 500};color:${done ? "#15803d" : now ? "#1d4ed8" : "#94a3b8"};">${done ? "&#10003; " : ""}${label}</div>
                </td>`;
                })
                .join('<td width="8" style="font-size:0;">&nbsp;</td>')}
              </tr></table>
            </td>
          </tr>`;

  const preheader =
    kind === "confirmation"
      ? `Order #${order.id} · ${itemCount} ${itemCount === 1 ? "item" : "items"} · ${money(order.total)}`
      : `Order #${order.id} is now ${status.label.toLowerCase()}`;

  const html = emailShell({
    title: copy.subject(order.id),
    preheader,
    body: `          <!-- Status hero -->
          <tr>
            <td style="padding:0;background:${copy.tint || "#f8fafc"};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td align="center" style="padding:36px 32px 30px;font-family:${FONT};">
                  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                    <td align="center" valign="middle" width="56" height="56" style="width:56px;height:56px;border-radius:50%;background:${copy.accent};color:#ffffff;font-size:24px;font-weight:700;line-height:56px;text-align:center;">${copy.icon || "&#10003;"}</td>
                  </tr></table>
                  <div style="margin-top:16px;font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${copy.accent};">${escapeHtml(copy.eyebrow)}</div>
                  <h1 style="margin:8px 0 10px;font-size:26px;line-height:1.25;color:#0f172a;font-weight:800;letter-spacing:-0.4px;">${escapeHtml(copy.title(firstName))}</h1>
                  <p style="margin:0 auto;max-width:440px;font-size:15px;line-height:1.6;color:#475569;">${escapeHtml(copy.message)}</p>
                </td>
              </tr></table>
            </td>
          </tr>
${tracker}
          <!-- Order summary -->
          <tr>
            <td style="padding:24px 32px 4px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8ecf2;border-radius:14px;">
                <tr>
                  <td style="padding:14px 18px;font-family:${FONT};border-right:1px solid #e8ecf2;">
                    <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;">Order</div>
                    <div style="font-size:16px;font-weight:700;color:#0f172a;margin-top:4px;">#${Number(order.id)}</div>
                  </td>
                  <td style="padding:14px 18px;font-family:${FONT};border-right:1px solid #e8ecf2;">
                    <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;">Date</div>
                    <div style="font-size:14px;font-weight:600;color:#0f172a;margin-top:4px;">${escapeHtml(longDate(order.created_at))}</div>
                  </td>
                  <td align="right" style="padding:14px 18px;font-family:${FONT};">
                    <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;">Status</div>
                    <span style="display:inline-block;margin-top:4px;padding:4px 12px;border-radius:999px;background:${status.bg};color:${status.color};font-size:13px;font-weight:700;">${status.label}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Items -->
          <tr>
            <td style="padding:22px 32px 0;font-family:${FONT};">
              <div style="font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;margin-bottom:2px;">Your items</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${itemRows}
              </table>
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding:16px 32px 4px;font-family:${FONT};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:14px;">
                <tr>
                  <td style="padding:16px 18px 4px;font-size:14px;color:#64748b;">Subtotal (${itemCount} ${itemCount === 1 ? "item" : "items"})</td>
                  <td align="right" style="padding:16px 18px 4px;font-size:14px;color:#0f172a;">${money(subtotal)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 18px 12px;font-size:14px;color:#64748b;">Delivery</td>
                  <td align="right" style="padding:4px 18px 12px;font-size:14px;color:#0f172a;">${deliveryFee ? money(deliveryFee) : `<span style="color:#15803d;font-weight:700;">Free</span>`}</td>
                </tr>
                <tr>
                  <td style="padding:12px 18px 16px;font-size:16px;font-weight:700;color:#0f172a;border-top:1px solid #e8ecf2;">Total</td>
                  <td align="right" style="padding:12px 18px 16px;font-size:22px;font-weight:800;color:#0f172a;border-top:1px solid #e8ecf2;">${money(order.total)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Delivery + payment -->
          <tr>
            <td style="padding:22px 32px 0;font-family:${FONT};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td valign="top" width="58%" style="padding-right:12px;">
                  <div style="font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;margin-bottom:8px;">Delivering to</div>
                  <div style="font-size:14px;line-height:1.7;color:#0f172a;">
                    <strong>${escapeHtml(order.customer_name)}</strong><br>
                    ${escapeHtml(order.customer_phone)}<br>
                    ${escapeHtml(order.customer_address)}
                  </div>
                </td>
                <td valign="top" width="42%">${
                  paymentLabel
                    ? `<div style="font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;margin-bottom:8px;">Payment</div>
                  <span style="display:inline-block;padding:6px 12px;border-radius:10px;background:#ecfdf5;color:#15803d;font-size:13px;font-weight:700;">${escapeHtml(paymentLabel)}</span>`
                    : ""
                }</td>
              </tr></table>
            </td>
          </tr>

          <!-- Button -->
          <tr>
            <td align="center" style="padding:30px 32px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td align="center" style="border-radius:12px;background:#2563eb;background-image:linear-gradient(180deg,#3b82f6,#2563eb);box-shadow:0 6px 16px rgba(37,99,235,0.3);">
                  <a href="${escapeHtml(orderUrl)}" style="display:inline-block;padding:15px 38px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">View your order &rarr;</a>
                </td>
              </tr></table>
            </td>
          </tr>

`,
    help: `<strong style="color:#0f172a;">Questions about your order?</strong><br>Just reply to this email or call us at <strong style="color:#15803d;">${PHONE}</strong>.`,
    siteUrl,
    footnote: `You're receiving this email because you placed an order at ${BRAND}.`,
  });

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
    `Delivery: ${deliveryFee ? money(deliveryFee) : "Free"}`,
    `Total: ${money(order.total)}`,
    ...(paymentLabel ? [`Payment: ${paymentLabel}`] : []),
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

/*
  "Reset your password" email.
  name: the customer's name, resetUrl: the one-time link (expires after `minutes`).
*/
function buildPasswordResetEmail({ name, resetUrl, minutes = 30 }) {
  const rawFirst = String(name || "").trim().split(/\s+/)[0] || "there";
  const firstName = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1);
  const attachments = fs.existsSync(LOGO_PATH)
    ? [{ filename: "megatech-logo.png", path: LOGO_PATH, cid: "logo@megatech" }]
    : [];

  const body = `
          <tr>
            <td align="center" style="padding:36px 32px 30px;font-family:${FONT};background:#fffbeb;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td align="center" valign="middle" width="56" height="56" style="width:56px;height:56px;border-radius:50%;background:#b45309;color:#ffffff;font-size:24px;line-height:56px;text-align:center;">&#128274;</td>
              </tr></table>
              <div style="margin-top:16px;font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#b45309;">Account security</div>
              <h1 style="margin:8px 0 10px;font-size:26px;line-height:1.25;color:#0f172a;font-weight:800;letter-spacing:-0.4px;">Reset your password</h1>
              <p style="margin:0 auto;max-width:440px;font-size:15px;line-height:1.6;color:#475569;">Hi ${escapeHtml(firstName)}, we received a request to reset the password for your ${BRAND} account. Click the button below to choose a new one.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 28px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td align="center" style="border-radius:12px;background:#2563eb;background-image:linear-gradient(180deg,#3b82f6,#2563eb);box-shadow:0 6px 16px rgba(37,99,235,0.3);">
                  <a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">Choose a new password</a>
                </td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 0;font-family:${FONT};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;border:1px solid #eceef1;border-radius:14px;">
                <tr><td style="padding:14px 16px;font-size:13px;line-height:1.6;color:#4b5563;">
                  This link works for <strong>${minutes} minutes</strong> and can be used once.
                  If you didn't ask to reset your password, you can ignore this email. Your password won't change.
                </td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:#6b7280;word-break:break-all;">
              Button not working? Copy this link into your browser:<br>
              <a href="${escapeHtml(resetUrl)}" style="color:#2563eb;">${escapeHtml(resetUrl)}</a>
            </td>
          </tr>
`;

  const html = emailShell({
    title: `Reset your ${BRAND} password`,
    preheader: `Use this link within ${minutes} minutes to choose a new password.`,
    body,
    help: `Need help? Just reply to this email or call us at <strong style="color:#1f2937;">${PHONE}</strong>.`,
    footnote: `You're receiving this email because a password reset was requested for your ${BRAND} account.`,
  });

  const text = [
    `Hi ${firstName},`,
    "",
    `We received a request to reset the password for your ${BRAND} account.`,
    `Choose a new password here (works for ${minutes} minutes, once):`,
    resetUrl,
    "",
    "If you didn't ask for this, you can ignore this email. Your password won't change.",
    "",
    `${BRAND} · ${PHONE}`,
  ].join("\n");

  return { subject: `Reset your ${BRAND} password`, html, text, attachments };
}

/*
  "Confirm your email" email with a 6-digit code.
*/
function buildVerificationEmail({ name, code, minutes = 15 }) {
  const rawFirst = String(name || "").trim().split(/\s+/)[0] || "there";
  const firstName = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1);
  const attachments = fs.existsSync(LOGO_PATH)
    ? [{ filename: "megatech-logo.png", path: LOGO_PATH, cid: "logo@megatech" }]
    : [];
  const spaced = String(code).split("").join(" ");

  const body = `
          <tr>
            <td align="center" style="padding:36px 32px 30px;font-family:${FONT};background:#eff6ff;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td align="center" valign="middle" width="56" height="56" style="width:56px;height:56px;border-radius:50%;background:#1d4ed8;color:#ffffff;font-size:24px;line-height:56px;text-align:center;">&#9993;</td>
              </tr></table>
              <div style="margin-top:16px;font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#1d4ed8;">Confirm your email</div>
              <h1 style="margin:8px 0 10px;font-size:26px;line-height:1.25;color:#0f172a;font-weight:800;letter-spacing:-0.4px;">Welcome to ${BRAND}, ${escapeHtml(firstName)}!</h1>
              <p style="margin:0 auto;max-width:440px;font-size:15px;line-height:1.6;color:#475569;">Enter this code on the ${BRAND} website to confirm your email and finish creating your account.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:26px 28px 6px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;">
                <tr><td align="center" style="padding:18px 30px;font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:700;letter-spacing:6px;color:#1e3a8a;">${escapeHtml(spaced)}</td></tr>
              </table>
              <div style="margin-top:12px;font-family:${FONT};font-size:13px;color:#6b7280;">This code works for ${minutes} minutes.</div>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 28px 0;font-family:${FONT};font-size:13px;line-height:1.6;color:#4b5563;text-align:center;">
              If you didn't create a ${BRAND} account, you can ignore this email.
            </td>
          </tr>
`;

  const html = emailShell({
    title: `Your ${BRAND} code: ${code}`,
    preheader: `Your code is ${code}. It works for ${minutes} minutes.`,
    body,
    help: `Need help? Just reply to this email or call us at <strong style="color:#1f2937;">${PHONE}</strong>.`,
    footnote: `You're receiving this email because this address was used to sign up at ${BRAND}.`,
  });

  const text = [
    `Welcome to ${BRAND}, ${firstName}!`,
    "",
    `Your code is: ${code}`,
    `Enter it on the ${BRAND} website to confirm your email. It works for ${minutes} minutes.`,
    "",
    `If you didn't create a ${BRAND} account, you can ignore this email.`,
  ].join("\n");

  return { subject: `${code} is your ${BRAND} code`, html, text, attachments };
}

/*
  Admin sign-in code (2-step sign-in): sent when someone types the right admin password on a
  device that isn't trusted yet. It also warns the owner if someone else knows the password.
    when    "5 Nov 2026, 14:20"
    device  "Chrome on Mac" (a guess from the browser)
*/
function buildAdminCodeEmail({ code, minutes = 10, when, device }) {
  const attachments = fs.existsSync(LOGO_PATH)
    ? [{ filename: "megatech-logo.png", path: LOGO_PATH, cid: "logo@megatech" }]
    : [];
  const spaced = String(code).split("").join(" ");

  const body = `
          <tr>
            <td align="center" style="padding:36px 32px 30px;font-family:${FONT};background:#fffbeb;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td align="center" valign="middle" width="56" height="56" style="width:56px;height:56px;border-radius:50%;background:#b45309;color:#ffffff;font-size:24px;line-height:56px;text-align:center;">&#128273;</td>
              </tr></table>
              <div style="margin-top:16px;font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#b45309;">Admin sign-in</div>
              <h1 style="margin:8px 0 10px;font-size:26px;line-height:1.25;color:#0f172a;font-weight:800;letter-spacing:-0.4px;">Your sign-in code</h1>
              <p style="margin:0 auto;max-width:440px;font-size:15px;line-height:1.6;color:#475569;">Someone typed the right admin password and needs this code to get in.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:26px 28px 6px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:14px;">
                <tr><td align="center" style="padding:18px 30px;font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:700;letter-spacing:6px;color:#78350f;">${escapeHtml(spaced)}</td></tr>
              </table>
              <div style="margin-top:12px;font-family:${FONT};font-size:13px;color:#6b7280;">This code works for ${minutes} minutes.</div>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 28px 0;font-family:${FONT};font-size:14px;line-height:1.7;color:#4b5563;text-align:center;">
              <strong style="color:#1f2937;">When:</strong> ${escapeHtml(when)}<br />
              <strong style="color:#1f2937;">Device:</strong> ${escapeHtml(device)}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 0;font-family:${FONT};font-size:13px;line-height:1.6;color:#9b2c2c;text-align:center;">
              Wasn't you? Don't share this code. Someone knows your admin password: change it in Admin &rarr; Settings.
            </td>
          </tr>
`;

  const html = emailShell({
    title: `Your ${BRAND} admin code: ${code}`,
    preheader: `Admin sign-in code ${code}. It works for ${minutes} minutes.`,
    body,
    help: `This email only goes to the shop owner.`,
    footnote: `You're receiving this email because 2-step sign-in is on for the ${BRAND} admin.`,
  });

  const text = [
    `Your ${BRAND} admin sign-in code is: ${code}`,
    `It works for ${minutes} minutes.`,
    "",
    `When: ${when}`,
    `Device: ${device}`,
    "",
    "Wasn't you? Don't share this code. Someone knows your admin password: change it in Admin > Settings.",
  ].join("\n");

  return { subject: `${code} is your ${BRAND} admin sign-in code`, html, text, attachments };
}

/*
  Email to the shop owner: a new order came in, or a customer cancelled one.
    kind:  "new" | "cancelled"
    order: { id, customer_name, customer_phone, customer_address, total, delivery_fee, payment_method, created_at }
    items: [{ name, price, qty }]
    adminUrl: link to the order in the admin panel
*/
function buildAdminOrderEmail({ kind = "new", order, items, adminUrl, customerEmail }) {
  const isNew = kind === "new";
  const itemCount = items.reduce((n, it) => n + Number(it.qty), 0);
  const payment = PAYMENT_LABELS[order.payment_method] || "";
  const subject = isNew
    ? `🛒 New order #${order.id} · ${money(order.total)} · ${order.customer_name}`
    : `Order #${order.id} was cancelled by the customer`;

  const attachments = fs.existsSync(LOGO_PATH)
    ? [{ filename: "megatech-logo.png", path: LOGO_PATH, cid: "logo@megatech" }]
    : [];

  const rows = items
    .map(
      (it) => `<tr>
        <td style="padding:8px 0;font-size:14px;color:#1f2937;border-bottom:1px solid #eef2f6;">${escapeHtml(String(it.name).trim())}</td>
        <td align="center" style="padding:8px 0;font-size:14px;color:#6b7280;border-bottom:1px solid #eef2f6;">× ${Number(it.qty)}</td>
        <td align="right" style="padding:8px 0;font-size:14px;color:#1f2937;border-bottom:1px solid #eef2f6;">${money(Number(it.price) * Number(it.qty))}</td>
      </tr>`
    )
    .join("");

  const html = emailShell({
    title: subject,
    preheader: isNew
      ? `${itemCount} ${itemCount === 1 ? "item" : "items"} · ${order.customer_phone}`
      : "The items went back into stock automatically.",
    body: `
          <tr>
            <td style="padding:28px 28px 0;font-family:${FONT};">
              <div style="font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${isNew ? "#15803d" : "#b91c1c"};"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${isNew ? "#16a34a" : "#dc2626"};margin-right:8px;vertical-align:1px;"></span>${isNew ? "New order" : "Order cancelled"}</div>
              <h1 style="margin:8px 0 6px;font-size:24px;line-height:1.25;color:#111111;">Order #${order.id} · ${money(order.total)}</h1>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#4b5563;">
                ${isNew ? "A customer just placed an order. It's waiting for you as <strong>Pending</strong>." : "The customer cancelled this order from their account. Its items went back into stock automatically."}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 0;font-family:${FONT};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}
                <tr>
                  <td colspan="2" style="padding:10px 0 0;font-size:14px;color:#6b7280;">Delivery</td>
                  <td align="right" style="padding:10px 0 0;font-size:14px;color:#1f2937;">${Number(order.delivery_fee) ? money(order.delivery_fee) : "Free"}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:6px 0 0;font-size:16px;font-weight:700;color:#111111;">Total</td>
                  <td align="right" style="padding:6px 0 0;font-size:18px;font-weight:700;color:#111111;">${money(order.total)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 28px 0;font-family:${FONT};font-size:14px;line-height:1.7;color:#1f2937;">
              <strong>${escapeHtml(order.customer_name)}</strong><br>
              ${escapeHtml(order.customer_phone)}${customerEmail ? ` · ${escapeHtml(customerEmail)}` : ""}<br>
              ${escapeHtml(order.customer_address)}${payment ? `<br>Payment: ${escapeHtml(payment)}` : ""}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 28px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td align="center" style="border-radius:12px;background:#2563eb;background-image:linear-gradient(180deg,#3b82f6,#2563eb);box-shadow:0 6px 16px rgba(37,99,235,0.3);">
                  <a href="${escapeHtml(adminUrl)}" style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">Open the order</a>
                </td>
              </tr></table>
            </td>
          </tr>
`,
    help: "You get this email for every new or cancelled order.",
    footnote: `${BRAND} admin notification`,
  });

  const text = [
    isNew ? `New order #${order.id}` : `Order #${order.id} was cancelled by the customer`,
    "",
    ...items.map((it) => `- ${String(it.name).trim()}  x${it.qty}  ${money(Number(it.price) * Number(it.qty))}`),
    `Delivery: ${Number(order.delivery_fee) ? money(order.delivery_fee) : "Free"}`,
    `Total: ${money(order.total)}`,
    "",
    order.customer_name,
    order.customer_phone,
    order.customer_address,
    ...(payment ? [`Payment: ${payment}`] : []),
    "",
    `Open the order: ${adminUrl}`,
  ].join("\n");

  return { subject, html, text, attachments };
}

module.exports = { buildOrderEmail, buildPasswordResetEmail, buildVerificationEmail, buildAdminOrderEmail, buildAdminCodeEmail };
