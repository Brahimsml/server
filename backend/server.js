require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const mysql = require("mysql");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const nodemailer = require("nodemailer");
const createChatbot = require("./chatbot");
const { buildOrderEmail, buildPasswordResetEmail, buildVerificationEmail, buildAdminOrderEmail, buildAdminCodeEmail } = require("./emails");
const { processProductUpload, processProductUploads, processBannerUploads, processPromoUploads } = require("./productImages");
const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
  console.error("❌ JWT_SECRET is missing. Add it to backend/.env");
  process.exit(1);
}
// Online, a short or example secret would let someone fake sign-ins
if (process.env.NODE_ENV === "production" && (SECRET.length < 32 || SECRET === "change-me")) {
  console.error("❌ JWT_SECRET is too weak for a live shop. Make a long random one (see .env.example).");
  process.exit(1);
}

const app = express();
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
// Only our own website may call the API from a browser (SITE_URL in .env, comma-separated).
// Requests without an Origin header (same-origin, server-to-server, curl) are allowed.
const allowedOrigins = String(process.env.SITE_URL || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

// While developing (not in production), also allow the shop opened from a phone on the
// same Wi-Fi, e.g. http://192.168.0.16:3000, whatever address the router gives the computer
const isHomeWifiTest = (origin) =>
  process.env.NODE_ENV !== "production" &&
  /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):3000$/.test(origin);

// Main website address, used for links in emails
const SITE_URL = allowedOrigins[0];

// Standard security headers. Images are allowed to show on the website's own address
// (the shop runs on a different address than this API).
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// Smaller responses (product lists, pages) so the shop loads faster
app.use(compression());

app.use(
  cors({
    origin: (origin, callback) =>
      callback(null, !origin || allowedOrigins.includes(origin) || isHomeWifiTest(origin)),
  })
);
// Requests bigger than this are refused (stops someone slowing the server with huge requests).
// Pictures don't count: they're uploaded separately, up to 5 MB each.
app.use(express.json({ limit: "100kb" }));

// Online the shop sits behind the host's proxy: set TRUST_PROXY=1 in .env there, so the limits
// below see each visitor's real address instead of the proxy's one (everyone sharing one limit).
if (process.env.TRUST_PROXY) {
  const hops = Number(process.env.TRUST_PROXY);
  app.set("trust proxy", Number.isInteger(hops) ? hops : process.env.TRUST_PROXY);
}

/*
   REQUEST LIMITS (stop bots flooding sign-up, emails, orders, the chat...)
   Counted per visitor address. Each limit says how many requests are allowed in how long.
*/
const limitStores = [];

// Simple per-key request limit, e.g. 5 per 15 minutes from one IP. Returns true when blocked.
const tooManyRequests = (store, key, max, windowMs) => {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  if (entry.count >= max) return true;
  entry.count += 1;
  return false;
};

// Middleware: at most `max` requests per `minutes` from one address
// (perAccount: counted per signed-in customer instead, so people sharing a connection never block each other)
const limitRequests = (max, minutes, message = "Too many requests. Please wait a few minutes and try again.", { perAccount = false } = {}) => {
  const store = new Map();
  limitStores.push(store);
  return (req, res, next) => {
    const key = perAccount && req.user ? `user:${req.user.id}` : req.ip;
    return tooManyRequests(store, key, max, minutes * 60 * 1000) ? res.status(429).json({ message }) : next();
  };
};

// Forget finished limits every 10 minutes so the lists don't keep growing
setInterval(() => {
  const now = Date.now();
  for (const store of limitStores) {
    for (const [key, entry] of store) if (entry.resetAt <= now) store.delete(key);
  }
}, 10 * 60 * 1000).unref();

// Everything together: 600 requests per 5 minutes is far more than a shopper needs (pictures don't count)
const limitEverything = limitRequests(600, 5);
app.use((req, res, next) => (req.path.startsWith("/images/") || req.path.startsWith("/img/") ? next() : limitEverything(req, res, next)));

/*
   STATIC IMAGES
*/
// Browsers may keep images for a day instead of downloading them on every visit
/*
   LIGHTER PICTURES: /img/<width>/<file> serves a WebP copy of an uploaded picture at that width,
   made the first time it's asked for and kept in image-cache/ (rebuilt if the picture changes).
   Pages list several widths and the browser downloads the smallest that still looks sharp, so
   phones get small files. The original in images/ is never changed.
*/
const IMG_WIDTHS = [160, 320, 480, 800, 1200, 1600, 2400];
const imageCacheDir = path.join(__dirname, "image-cache");
fs.mkdirSync(imageCacheDir, { recursive: true });
const resizing = new Map(); // file being made -> its promise (several requests at once make it once)

app.get("/img/:w/:file", async (req, res) => {
  const width = Number(req.params.w);
  const file = path.basename(String(req.params.file || ""));
  if (!IMG_WIDTHS.includes(width) || !/\.(jpe?g|png|webp|gif)$/i.test(file)) return res.status(404).end();
  const source = path.join(__dirname, "images", file);
  const cached = path.join(imageCacheDir, `${width}-${file}.webp`);
  try {
    const src = await fs.promises.stat(source);
    const done = await fs.promises.stat(cached).catch(() => null);
    if (!done || done.mtimeMs < src.mtimeMs) {
      if (!resizing.has(cached)) {
        const tmp = `${cached}.${process.pid}.tmp`;
        const job = sharp(source)
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(tmp)
          .then(() => fs.promises.rename(tmp, cached))
          .finally(() => resizing.delete(cached));
        resizing.set(cached, job);
      }
      await resizing.get(cached);
    }
    res.set("Cache-Control", "public, max-age=2592000"); // 30 days
    res.type("image/webp").sendFile(cached);
  } catch (err) {
    if (err.code === "ENOENT") return res.status(404).end();
    console.error("❌ Could not make a smaller picture:", err.message);
    res.redirect(302, `/images/${encodeURIComponent(file)}`); // fall back to the original
  }
});

app.use("/images", express.static(path.join(__dirname, "images"), { maxAge: "1d" }));

/*
   MULTER CONFIG
*/

const imagesDir = path.join(__dirname, "images");

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, imagesDir);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    const cleanName = path
      .basename(file.originalname, ext)
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-_]/g, "");

    cb(null, `${cleanName}_${Date.now()}${ext}`);
  },
});

const ALLOWED_IMAGE_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5 MB

// Delete an image file once no product or place uses it any more
const removeImageIfUnused = (image) => {
  if (!image || image.startsWith("http")) return;
  const file = path.basename(image); // never touch anything outside /images

  db.query(
    `SELECT (SELECT COUNT(*) FROM products WHERE image=?) + (SELECT COUNT(*) FROM places WHERE image=?)
          + (SELECT COUNT(*) FROM product_images WHERE image=?) + (SELECT COUNT(*) FROM banners WHERE image=? OR image_mobile=?)
          + (SELECT COUNT(*) FROM categories WHERE image=?) AS n`,
    [file, file, file, file, file, file],
    (err, rows) => {
      if (err || rows[0].n > 0) return;
      fs.unlink(path.join(imagesDir, file), (unlinkErr) => {
        if (unlinkErr && unlinkErr.code !== "ENOENT") console.error("❌ Image delete failed:", unlinkErr);
      });
    }
  );
};

// Remove a just-uploaded file when saving the row failed
const discardUpload = (req) => {
  const files = req.files ? Object.values(req.files).flat() : req.file ? [req.file] : [];
  files.forEach((file) => fs.unlink(file.path, () => {}));
};

// Current image of a product/place row (table name is fixed in code, never user input)
const getCurrentImage = (table, id, cb) =>
  db.query(`SELECT image FROM ${table} WHERE id=?`, [id], (err, rows) =>
    cb(err, rows && rows[0] ? rows[0].image : null)
  );

// Only real image types (extension and type must match)
const imageFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (ALLOWED_IMAGE_TYPES[ext] && ALLOWED_IMAGE_TYPES[ext] === file.mimetype) {
    return cb(null, true);
  }

  const err = new Error("Only JPG, PNG, WEBP or GIF images are allowed");
  err.status = 400;
  cb(err);
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_SIZE, files: 1 },
  fileFilter: imageFileFilter,
});

// Product form: main photo + up to 8 extra photos
const MAX_GALLERY = 8;
const productUpload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_SIZE, files: 1 + MAX_GALLERY },
  fileFilter: imageFileFilter,
});

/*
   DB CONNECTION
*/
// A pool (not one shared connection) so checkout can run its own transaction
const db = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT),
});

db.getConnection((err, conn) => {
  if (err) {
    console.log("❌ DB connection error:", err);
    return;
  }
  conn.release();
  console.log("✅ Connected to MySQL (pc_store)");
});

// Promise helper for queries on a single connection (used by checkout transaction)
const runQuery = (conn, sql, params) =>
  new Promise((resolve, reject) => {
    conn.query(sql, params, (err, result) => (err ? reject(err) : resolve(result)));
  });

// Run work(conn) inside a transaction: commit if it finishes, roll back if it throws
const withTransaction = async (work) => {
  const conn = await new Promise((resolve, reject) =>
    db.getConnection((err, c) => (err ? reject(err) : resolve(c)))
  );
  try {
    await runQuery(conn, "START TRANSACTION");
    const result = await work(conn);
    await runQuery(conn, "COMMIT");
    return result;
  } catch (err) {
    await runQuery(conn, "ROLLBACK").catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
};

// Error with an HTTP status, for "expected" failures inside withTransaction
const httpError = (status, message) => Object.assign(new Error(message), { status });

// Put an order's items back into stock
const restoreOrderStock = async (conn, orderId) => {
  const items = await runQuery(
    conn,
    "SELECT product_id, quantity FROM order_items WHERE order_id=?",
    [orderId]
  );
  for (const it of items) {
    await runQuery(conn, "UPDATE products SET stock_quantity = stock_quantity + ? WHERE id=?", [
      it.quantity,
      it.product_id,
    ]);
  }
};

/*
   SIGN OUT OTHER DEVICES
   Every sign-in carries the account's session number (sv). Changing the password raises the
   number, so sign-ins made before it (other phones, laptops) stop working straight away.
   Sign-ins from before this existed have no sv and count as 0.
*/
const checkSession = (table, decoded, res, next) => {
  db.query(`SELECT session_version FROM ${table} WHERE id=?`, [decoded.id], (err, rows) => {
    if (err) return serverError(res, err);
    if (!rows.length || Number(rows[0].session_version) !== Number(decoded.sv || 0)) {
      return res.status(401).json({ message: "You were signed out. Please sign in again." });
    }
    next();
  });
};

/*
   JWT MIDDLEWARE (ADMIN)
*/
const verifyAdmin = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(403).json({ message: "No token provided" });

  const token = auth.split(" ")[1];

  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Token invalid/expired" });

    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    checkSession("admins", decoded, res, () => {
      req.admin = decoded;
      next();
    });
  });
};

// For routes anyone can call that show more to the admin (e.g. hidden products)
const isAdminRequest = (req) => {
  const token = String(req.headers.authorization || "").split(" ")[1];
  if (!token) return false;
  try {
    return jwt.verify(token, SECRET).role === "admin";
  } catch {
    return false;
  }
};

/*
   JWT MIDDLEWARE (USER)
*/
const verifyUser = (req, res, next) => {
  const auth = req.headers.authorization;

  if (!auth) {
    return res.status(403).json({ message: "Please login first" });
  }

  const token = auth.split(" ")[1];

  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    // Admin tokens can't act as a customer (ids are from different tables)
    if (decoded.role !== "user") {
      return res.status(401).json({ message: "Please login with a customer account" });
    }

    checkSession("users", decoded, res, () => {
      req.user = decoded;
      next();
    });
  });
};

/*
   LOGIN ATTEMPT LIMIT (stops password guessing)
   Max 10 failed logins per 15 minutes per IP + route; a successful login resets it.
*/
const LOGIN_MAX_FAILS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginFails = new Map();
limitStores.push(loginFails);

const limitLoginAttempts = (req, res, next) => {
  const key = `${req.ip}|${req.path}`;
  const now = Date.now();
  const entry = loginFails.get(key);

  if (entry && entry.resetAt <= now) loginFails.delete(key);

  const current = loginFails.get(key);
  if (current && current.count >= LOGIN_MAX_FAILS) {
    const minutes = Math.ceil((current.resetAt - now) / 60000);
    return res
      .status(429)
      .json({ message: `Too many failed logins. Try again in ${minutes} minute(s).` });
  }

  res.on("finish", () => {
    // routes can also flag a failed attempt without a 401 (see /admin/password)
    if (res.statusCode === 401 || res.locals.authFailed) {
      const e = loginFails.get(key) || { count: 0, resetAt: Date.now() + LOGIN_WINDOW_MS };
      e.count += 1;
      loginFails.set(key, e);
    } else if (res.statusCode === 200) {
      loginFails.delete(key);
    }
  });

  next();
};

/*
   ERROR RESPONSES
   Log the real DB error on the server, send the browser a plain message.
*/
const serverError = (res, err) => {
  console.error("❌ Server error:", err);
  return res.status(500).json({ message: "Server error" });
};

/*
   TEST ROUTE
*/
app.get("/", (req, res) => {
  res.send("PC Store backend working ✅");
});

/*
   ADMIN LOGIN
*/
/*
   2-STEP ADMIN SIGN-IN
   After the right password, a 6-digit code is emailed to the shop owner (ADMIN_CODE_EMAIL in .env,
   else ADMIN_NOTIFY_EMAIL, else the shop's own address). "Trust this device" skips the code on that
   browser for 30 days; changing the admin password ends every trusted device too.
   ADMIN_TWO_STEP=off in .env turns it off (only if emails can't be sent).
*/
const ADMIN_CODE_MINUTES = 10;
const ADMIN_CODE_MAX_TRIES = 5;
const ADMIN_TRUST_DAYS = 30;
const adminCodes = new Map(); // ticket -> { adminId, codeHash, expires, tries }
const adminCodeSends = new Map(); // admin id -> { count, resetAt }
limitStores.push(adminCodeSends);

const adminTwoStepOn = () => String(process.env.ADMIN_TWO_STEP || "").toLowerCase() !== "off";
const adminCodeEmail = () => process.env.ADMIN_CODE_EMAIL || process.env.ADMIN_NOTIFY_EMAIL || process.env.EMAIL_USER;

// "ib•••@gmail.com": shows which inbox to check without giving the address away
const maskEmail = (email) => {
  const [name, domain] = String(email).split("@");
  return domain ? `${name.slice(0, 2)}•••@${domain}` : "your email";
};

// "Chrome on Mac": a rough guess from the browser, for the code email
const describeDevice = (ua = "") => {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "A browser";
  const system = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return system ? `${browser} on ${system}` : browser;
};

const signAdminDevice = (admin) =>
  jwt.sign({ id: admin.id, purpose: "admin-device", sv: Number(admin.session_version || 0) }, SECRET, {
    expiresIn: `${ADMIN_TRUST_DAYS}d`,
  });

// A device the admin chose to trust (and the password hasn't changed since)
const isTrustedAdminDevice = (deviceToken, admin) => {
  if (!deviceToken) return false;
  try {
    const d = jwt.verify(String(deviceToken), SECRET);
    return d.purpose === "admin-device" && Number(d.id) === Number(admin.id) && Number(d.sv) === Number(admin.session_version || 0);
  } catch {
    return false;
  }
};

const adminSignedIn = (res, admin, extra = {}) =>
  res.json({ message: "Login success", token: signAdminToken(admin), admin: { id: admin.id, email: admin.email }, ...extra });

app.post("/admin/login", limitLoginAttempts, (req, res) => {
  const { email, password, device } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  const q = "SELECT * FROM admins WHERE email=?";
  db.query(q, [email], async (err, data) => {
    if (err) return serverError(res, err);

    if (!data || data.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(String(password), data[0].password);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const admin = data[0];
    if (!adminTwoStepOn() || isTrustedAdminDevice(device, admin)) return adminSignedIn(res, admin);

    // Right password on a new device: email a code
    if (tooManyRequests(adminCodeSends, admin.id, 5, 15 * 60 * 1000)) {
      return res.status(429).json({ message: "Too many codes were sent. Try again in 15 minutes." });
    }
    const to = adminCodeEmail();
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    const ticket = crypto.randomBytes(32).toString("hex");
    try {
      await transporter.sendMail({
        from: `"MegaTech" <${process.env.EMAIL_USER}>`,
        to,
        ...buildAdminCodeEmail({
          code,
          minutes: ADMIN_CODE_MINUTES,
          when: new Date().toLocaleString("en-GB", { timeZone: "Asia/Beirut", dateStyle: "medium", timeStyle: "short" }),
          device: describeDevice(req.get("user-agent")),
        }),
      });
    } catch (mailErr) {
      console.error("❌ Admin sign-in code email failed (if emails can't be sent, ADMIN_TWO_STEP=off in .env lets you in):", mailErr);
      return res.status(503).json({ message: "We couldn't send your sign-in code. Please try again in a minute." });
    }
    adminCodes.set(ticket, {
      adminId: admin.id,
      codeHash: await bcrypt.hash(code, 10),
      expires: Date.now() + ADMIN_CODE_MINUTES * 60 * 1000,
      tries: 0,
    });
    res.json({ needsCode: true, ticket, sentTo: maskEmail(to), minutes: ADMIN_CODE_MINUTES });
  });
});

// Step 2: the code from the email. Wrong codes count towards the sign-in limit.
app.post("/admin/login/code", limitLoginAttempts, async (req, res) => {
  const ticket = String(req.body?.ticket || "");
  const code = String(req.body?.code || "").replace(/\D/g, "");
  const entry = adminCodes.get(ticket);

  if (!entry || entry.expires < Date.now() || entry.tries >= ADMIN_CODE_MAX_TRIES) {
    adminCodes.delete(ticket);
    return res.status(400).json({ message: "This code has expired. Sign in again to get a new one.", expired: true });
  }
  if (code.length !== 6 || !(await bcrypt.compare(code, entry.codeHash))) {
    entry.tries += 1;
    return res.status(401).json({ message: "That code isn't right." });
  }

  adminCodes.delete(ticket);
  try {
    const [admin] = await runQuery(db, "SELECT id, email, session_version FROM admins WHERE id=?", [entry.adminId]);
    if (!admin) return res.status(401).json({ message: "Admin account not found" });
    adminSignedIn(res, admin, req.body?.trust ? { device: signAdminDevice(admin) } : {});
  } catch (err) {
    serverError(res, err);
  }
});

// Forget codes nobody used
setInterval(() => {
  const now = Date.now();
  for (const [ticket, entry] of adminCodes) if (entry.expires < now) adminCodes.delete(ticket);
}, 10 * 60 * 1000).unref();

/*
   CUSTOMER ACCOUNTS
   - Sign-up sends a 6-digit code; the account can't sign in until the email is confirmed.
   - "Continue with Google" (when GOOGLE_CLIENT_ID is set) signs in with a Google-verified email.
*/
const VERIFY_MINUTES = 15;
const VERIFY_MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

// "Keep me signed in": 30 days; otherwise 2 hours (and the browser forgets it when the tab closes)
const signUserToken = (user, remember) =>
  jwt.sign({ id: user.id, email: user.email, role: "user", sv: Number(user.session_version || 0) }, SECRET, {
    expiresIn: remember ? "30d" : "2h",
  });

const wantsRemember = (req) => req.body?.remember === true || req.body?.remember === "true";

const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email });

// Create a new code, store its hash, and email it.
// Skips sending if a code was sent less than a minute ago (unless force is set).
async function sendVerificationCode(user, { force = false } = {}) {
  const [row] = await runQuery(
    db,
    "SELECT verify_code_expires FROM users WHERE id=?",
    [user.id]
  );
  if (!force && row?.verify_code_expires) {
    const sentAt = new Date(row.verify_code_expires).getTime() - VERIFY_MINUTES * 60 * 1000;
    if (Date.now() - sentAt < RESEND_COOLDOWN_SECONDS * 1000) return false;
  }

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const hash = await bcrypt.hash(code, 10);
  await runQuery(
    db,
    "UPDATE users SET verify_code_hash=?, verify_code_expires=DATE_ADD(NOW(), INTERVAL ? MINUTE), verify_attempts=0 WHERE id=?",
    [hash, VERIFY_MINUTES, user.id]
  );

  try {
    await transporter.sendMail({
      from: `"MegaTech" <${process.env.EMAIL_USER}>`,
      to: user.email,
      ...buildVerificationEmail({ name: user.name, code, minutes: VERIFY_MINUTES }),
    });
    console.log(`✅ Verification code sent to ${user.email}`);
  } catch (emailErr) {
    console.error("❌ Verification email failed:", emailErr);
  }
  return true;
}

/*
   USER REGISTER
*/
app.post("/users/register", limitRequests(10, 60, "Too many sign-ups from here. Please try again later."), async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields required" });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Enter a valid email" });
  }

  if (String(password).length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  try {
    const cleanName = String(name).trim();
    const cleanEmail = String(email).trim();
    const hashedPassword = await bcrypt.hash(password, 10);
    const [existing] = await runQuery(db, "SELECT id, email_verified FROM users WHERE email=?", [cleanEmail]);

    let userId;
    if (existing) {
      if (existing.email_verified) {
        return res.status(409).json({ message: "Email already registered" });
      }
      // Never confirmed: whoever proves they own the inbox gets the account,
      // with the details from this latest sign-up.
      await runQuery(db, "UPDATE users SET name=?, password=? WHERE id=?", [cleanName, hashedPassword, existing.id]);
      userId = existing.id;
    } else {
      const result = await runQuery(
        db,
        "INSERT INTO users (name, email, password, email_verified) VALUES (?, ?, ?, 0)",
        [cleanName, cleanEmail, hashedPassword]
      );
      userId = result.insertId;
    }

    await sendVerificationCode({ id: userId, name: cleanName, email: cleanEmail }, { force: true });
    res.json({ message: "We sent a 6-digit code to your email.", needsVerification: true, email: cleanEmail });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Email already registered" });
    serverError(res, err);
  }
});

/*
   EMAIL-FIRST SIGN IN: does this email have an account?
   The sign-in form asks for the email first (like Amazon or Google), then shows the
   password step or the create-account step. That tells people whether an email has an
   account, so each visitor can only check 30 emails per 15 minutes.
*/
const emailChecks = new Map(); // ip -> { count, resetAt }
const EMAIL_CHECKS_MAX = 30;
const EMAIL_CHECKS_WINDOW_MS = 15 * 60 * 1000;

app.post("/users/check-email", limitRequests(30, 15), async (req, res) => {
  const now = Date.now();
  const entry = emailChecks.get(req.ip);
  const current = entry && entry.resetAt > now ? entry : { count: 0, resetAt: now + EMAIL_CHECKS_WINDOW_MS };
  if (current.count >= EMAIL_CHECKS_MAX) {
    return res.status(429).json({ message: "Too many tries. Please wait a few minutes and try again." });
  }
  current.count += 1;
  emailChecks.set(req.ip, current);

  const email = String(req.body?.email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }
  try {
    const [user] = await runQuery(db, "SELECT email_verified, google_id FROM users WHERE email=?", [email]);
    // a sign-up that was never confirmed counts as new: signing up again takes it over
    res.json({ exists: Boolean(user && (user.email_verified || user.google_id)), google: Boolean(user?.google_id) });
  } catch (err) {
    serverError(res, err);
  }
});

/*
   USER LOGIN
*/
app.post("/users/login", limitLoginAttempts, (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  db.query("SELECT * FROM users WHERE email=?", [email], async (err, data) => {
    if (err) return serverError(res, err);

    // Same message for unknown email and wrong password, so nobody can
    // find out which emails have accounts
    const valid = data.length > 0 && (await bcrypt.compare(String(password), data[0].password));

    if (!valid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Right password but the email was never confirmed: send a fresh code
    if (!data[0].email_verified) {
      try {
        await sendVerificationCode(data[0]);
      } catch (e) {
        console.error("❌ Could not create a verification code:", e);
      }
      return res.status(403).json({
        message: "Please confirm your email first. We sent you a code.",
        needsVerification: true,
        email: data[0].email,
      });
    }

    res.json({
      message: "Login success",
      token: signUserToken(data[0], wantsRemember(req)),
      user: publicUser(data[0]),
    });
  });
});

/*
   CONFIRM EMAIL WITH THE 6-DIGIT CODE
*/
app.post("/users/verify-email", limitLoginAttempts, async (req, res) => {
  const email = String(req.body?.email || "").trim();
  const code = String(req.body?.code || "").replace(/\D/g, "");

  if (!email || code.length !== 6) {
    return res.status(400).json({ message: "Enter the 6-digit code from the email." });
  }

  try {
    const [user] = await runQuery(db, "SELECT * FROM users WHERE email=?", [email]);
    if (!user) return res.status(400).json({ message: "That code isn't right." });
    if (user.email_verified) {
      return res.status(400).json({ message: "This email is already confirmed. Please sign in.", alreadyVerified: true });
    }

    const expired = !user.verify_code_hash || new Date(user.verify_code_expires).getTime() < Date.now();
    if (expired || user.verify_attempts >= VERIFY_MAX_ATTEMPTS) {
      return res.status(400).json({
        message: expired ? "This code has expired. Request a new one." : "Too many wrong tries. Request a new code.",
        needsNewCode: true,
      });
    }

    if (!(await bcrypt.compare(code, user.verify_code_hash))) {
      await runQuery(db, "UPDATE users SET verify_attempts = verify_attempts + 1 WHERE id=?", [user.id]);
      const left = VERIFY_MAX_ATTEMPTS - user.verify_attempts - 1;
      return res.status(400).json({
        message: left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong tries. Request a new code.",
        needsNewCode: left <= 0,
      });
    }

    await runQuery(
      db,
      "UPDATE users SET email_verified=1, verify_code_hash=NULL, verify_code_expires=NULL, verify_attempts=0 WHERE id=?",
      [user.id]
    );

    // Confirmed: sign them straight in
    res.json({ message: "Email confirmed", token: signUserToken(user, wantsRemember(req)), user: publicUser(user) });
  } catch (err) {
    serverError(res, err);
  }
});

/*
   SEND A NEW CODE
*/
const resendRequests = new Map(); // ip -> { count, resetAt }
limitStores.push(resendRequests);

app.post("/users/resend-code", async (req, res) => {
  const email = String(req.body?.email || "").trim();
  if (!email) return res.status(400).json({ message: "Enter your email" });

  if (tooManyRequests(resendRequests, req.ip, 5, 15 * 60 * 1000)) {
    return res.status(429).json({ message: "Too many requests. Please try again in a few minutes." });
  }

  try {
    const [user] = await runQuery(db, "SELECT id, name, email, email_verified FROM users WHERE email=?", [email]);
    let sent = true;
    if (user && !user.email_verified) sent = await sendVerificationCode(user);

    if (!sent) {
      return res.status(429).json({ message: `Please wait a minute before asking for another code.` });
    }
    // Same answer either way, so this can't be used to check which emails exist
    res.json({ message: "If that email is waiting for confirmation, we've sent a new code." });
  } catch (err) {
    serverError(res, err);
  }
});

/*
   MY ACCOUNT
*/
const accountDetails = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone || "",
  address: u.address || "",
  google_linked: !!u.google_id,
  created_at: u.created_at,
});

app.get("/users/me", verifyUser, async (req, res) => {
  try {
    const [user] = await runQuery(db, "SELECT * FROM users WHERE id=?", [req.user.id]);
    if (!user) return res.status(404).json({ message: "Account not found" });
    res.json(accountDetails(user));
  } catch (err) {
    serverError(res, err);
  }
});

app.put("/users/me", verifyUser, async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const phone = String(req.body?.phone || "").trim();
  const address = String(req.body?.address || "").trim();

  if (!name) return res.status(400).json({ message: "Enter your name." });
  if (name.length > 100 || phone.length > 30 || address.length > 255) {
    return res.status(400).json({ message: "One of the fields is too long." });
  }
  if (phone && !/^[0-9+()\s-]{6,30}$/.test(phone)) {
    return res.status(400).json({ message: "Enter a valid phone number." });
  }

  try {
    await runQuery(db, "UPDATE users SET name=?, phone=?, address=? WHERE id=?", [
      name,
      phone || null,
      address || null,
      req.user.id,
    ]);
    const [user] = await runQuery(db, "SELECT * FROM users WHERE id=?", [req.user.id]);
    res.json({ message: "Your details were saved.", user: accountDetails(user) });
  } catch (err) {
    serverError(res, err);
  }
});

app.put("/users/me/password", verifyUser, limitLoginAttempts, async (req, res) => {
  const current = String(req.body?.current_password || "");
  const next = String(req.body?.new_password || "");

  if (next.length < 8) return res.status(400).json({ message: "Use at least 8 characters for the new password." });

  try {
    const [user] = await runQuery(db, "SELECT id, password FROM users WHERE id=?", [req.user.id]);
    if (!user || !(await bcrypt.compare(current, user.password))) {
      res.locals.authFailed = true;
      return res.status(400).json({ message: "Your current password isn't right." });
    }
    await runQuery(db, "UPDATE users SET password=?, session_version = session_version + 1 WHERE id=?", [
      await bcrypt.hash(next, 10),
      user.id,
    ]);
    // Other devices are signed out; this one gets a new sign-in that lasts as long as the old one
    const [fresh] = await runQuery(db, "SELECT id, email, session_version FROM users WHERE id=?", [user.id]);
    const remembered = req.user.exp - req.user.iat > 2 * 60 * 60;
    res.json({ message: "Your password was changed.", token: signUserToken(fresh, remembered) });
  } catch (err) {
    serverError(res, err);
  }
});

/*
   WISHLIST (saved in the customer's account)
*/
const MAX_WISHLIST = 200;

const wishlistFor = (userId) =>
  runQuery(
    db,
    `SELECT p.*, c.name AS category_name
     FROM wishlist_items w
     JOIN products p ON p.id = w.product_id
     JOIN categories c ON c.id = p.category_id
     WHERE w.user_id = ?
     ORDER BY w.created_at DESC, w.product_id DESC`,
    [userId]
  );

const productIdParam = (req) => {
  const id = Number(req.params.productId);
  return Number.isInteger(id) && id > 0 ? id : null;
};

app.get("/wishlist", verifyUser, async (req, res) => {
  try {
    res.json(await wishlistFor(req.user.id));
  } catch (err) {
    serverError(res, err);
  }
});

// After signing in: add what the customer saved before signing in, then return the full list
app.post("/wishlist/merge", verifyUser, async (req, res) => {
  const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number))]
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, MAX_WISHLIST);
  try {
    if (ids.length) {
      await runQuery(
        db,
        "INSERT IGNORE INTO wishlist_items (user_id, product_id) SELECT ?, id FROM products WHERE id IN (?)",
        [req.user.id, ids]
      );
    }
    res.json(await wishlistFor(req.user.id));
  } catch (err) {
    serverError(res, err);
  }
});

app.post("/wishlist/:productId", verifyUser, async (req, res) => {
  const productId = productIdParam(req);
  if (!productId) return res.status(400).json({ message: "Unknown product" });
  try {
    const [{ n }] = await runQuery(db, "SELECT COUNT(*) AS n FROM wishlist_items WHERE user_id=?", [req.user.id]);
    if (n >= MAX_WISHLIST) return res.status(400).json({ message: `Your wishlist can hold up to ${MAX_WISHLIST} products.` });
    // only products that exist (IGNORE: saving twice is fine)
    const result = await runQuery(
      db,
      "INSERT IGNORE INTO wishlist_items (user_id, product_id) SELECT ?, id FROM products WHERE id=?",
      [req.user.id, productId]
    );
    if (!result.affectedRows) {
      const [exists] = await runQuery(db, "SELECT id FROM products WHERE id=?", [productId]);
      if (!exists) return res.status(404).json({ message: "Product not found" });
    }
    res.json({ message: "Saved" });
  } catch (err) {
    serverError(res, err);
  }
});

app.delete("/wishlist/:productId", verifyUser, async (req, res) => {
  const productId = productIdParam(req);
  if (!productId) return res.status(400).json({ message: "Unknown product" });
  try {
    await runQuery(db, "DELETE FROM wishlist_items WHERE user_id=? AND product_id=?", [req.user.id, productId]);
    res.json({ message: "Removed" });
  } catch (err) {
    serverError(res, err);
  }
});

/*
   CONTINUE WITH GOOGLE
   The browser gets a signed ID token from Google; we check it with Google's library.
*/
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

app.post("/users/google", limitLoginAttempts, async (req, res) => {
  if (!googleClient) return res.status(503).json({ message: "Google sign-in isn't set up yet." });

  let profile;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: String(req.body?.credential || ""),
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    profile = ticket.getPayload();
  } catch {
    return res.status(401).json({ message: "Google sign-in failed. Please try again." });
  }

  if (!profile?.sub || !profile.email || !profile.email_verified) {
    return res.status(401).json({ message: "Your Google account email isn't verified." });
  }

  try {
    let [user] = await runQuery(db, "SELECT * FROM users WHERE google_id=?", [profile.sub]);

    if (!user) {
      [user] = await runQuery(db, "SELECT * FROM users WHERE email=?", [profile.email]);
      // An account nobody can sign into with a password (Google-only)
      const unusablePassword = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);

      if (user) {
        // Same email: link Google to it. If the email was never confirmed, drop that
        // password, since we can't know who set it. Google proves who owns the inbox.
        await runQuery(
          db,
          // password goes first: MySQL applies these left to right, so it must read the old email_verified
          `UPDATE users SET password = IF(email_verified = 1, password, ?), google_id=?, email_verified=1,
           verify_code_hash=NULL, verify_code_expires=NULL WHERE id=?`,
          [unusablePassword, profile.sub, user.id]
        );
      } else {
        const name = String(profile.name || profile.email.split("@")[0]).slice(0, 100);
        const result = await runQuery(
          db,
          "INSERT INTO users (name, email, password, email_verified, google_id) VALUES (?, ?, ?, 1, ?)",
          [name, profile.email, unusablePassword, profile.sub]
        );
        user = { id: result.insertId, name, email: profile.email };
      }
    }

    res.json({ message: "Login success", token: signUserToken(user, wantsRemember(req)), user: publicUser(user) });
  } catch (err) {
    serverError(res, err);
  }
});

/*
   CUSTOMER PASSWORD RESET
   The link is signed with the JWT secret + the customer's current password hash,
   so it stops working once the password changes (single use) or after 30 minutes.
*/
const RESET_MINUTES = 30;
const resetRequests = new Map(); // ip -> { count, resetAt }
limitStores.push(resetRequests);
const resetSecretFor = (user) => SECRET + user.password;

app.post("/users/forgot-password", (req, res) => {
  const email = String(req.body?.email || "").trim();
  if (!email) return res.status(400).json({ message: "Enter your email" });

  // at most 5 requests per 15 minutes from one address (stops inbox spamming)
  if (tooManyRequests(resetRequests, req.ip, 5, 15 * 60 * 1000)) {
    return res.status(429).json({ message: "Too many requests. Please try again in a few minutes." });
  }

  db.query("SELECT id, name, email, password FROM users WHERE email=?", [email], async (err, rows) => {
    if (err) return serverError(res, err);

    // Same answer whether or not the account exists, so nobody can find out who has one
    res.json({ message: "If an account exists for that email, we've sent a link to reset the password." });
    if (!rows.length) return;

    // Sent after replying, so the response time doesn't reveal anything either
    const user = rows[0];
    const token = jwt.sign({ id: user.id, purpose: "password-reset" }, resetSecretFor(user), {
      expiresIn: `${RESET_MINUTES}m`,
    });
    const resetUrl = `${SITE_URL}/reset-password?id=${user.id}&token=${encodeURIComponent(token)}`;

    try {
      await transporter.sendMail({
        from: `"MegaTech" <${process.env.EMAIL_USER}>`,
        to: user.email,
        ...buildPasswordResetEmail({ name: user.name, resetUrl, minutes: RESET_MINUTES }),
      });
      console.log(`✅ Password reset email sent to ${user.email}`);
    } catch (emailErr) {
      console.error("❌ Password reset email failed:", emailErr);
    }
  });
});

// The reset link's user, if the link is still good (expired, tampered with or already used: null)
const resetLinkUser = async (id, token) => {
  if (!id || !token) return null;
  const [user] = await runQuery(db, "SELECT * FROM users WHERE id=?", [id]);
  if (!user) return null;
  try {
    const payload = jwt.verify(String(token), resetSecretFor(user));
    return payload.purpose === "password-reset" && Number(payload.id) === Number(user.id) ? user : null;
  } catch {
    return null;
  }
};
const RESET_LINK_BROKEN = "This reset link is invalid or has expired. Please request a new one.";

// The reset page checks its link first: says straight away if it expired, and shows (and tells
// the browser's password manager) which account the new password is for
app.post("/users/reset-password/check", limitRequests(20, 15), async (req, res) => {
  try {
    const user = await resetLinkUser(req.body?.id, req.body?.token);
    if (!user) return res.status(400).json({ message: RESET_LINK_BROKEN });
    res.json({ email: user.email });
  } catch (err) {
    serverError(res, err);
  }
});

// New password, then signed in straight away (like Google or Apple): the link proved they own the inbox
app.post("/users/reset-password", limitRequests(20, 15), async (req, res) => {
  const { id, token, password } = req.body || {};
  if (!password || String(password).length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }
  try {
    const user = await resetLinkUser(id, token);
    if (!user) return res.status(400).json({ message: RESET_LINK_BROKEN });
    const hashed = await bcrypt.hash(String(password), 10);
    // the old password stops working here, and so does this link (it was signed with the old hash)
    // ...and every device signed in with it is signed out
    await runQuery(db, "UPDATE users SET password=?, email_verified=1, session_version = session_version + 1 WHERE id=?", [
      hashed,
      user.id,
    ]);
    res.json({
      message: "Your password was changed.",
      token: signUserToken({ ...user, session_version: Number(user.session_version || 0) + 1 }, wantsRemember(req)),
      user: publicUser(user),
    });
  } catch (err) {
    serverError(res, err);
  }
});

/*
   ADMIN ACCOUNT: change password + keep the session alive
*/
const signAdminToken = (admin) =>
  jwt.sign({ id: admin.id, email: admin.email, role: "admin", sv: Number(admin.session_version || 0) }, SECRET, {
    expiresIn: "1h",
  });

// Wrong current password returns 400 (not 401) so the admin isn't logged out,
// but it still counts towards the failed-attempt limit.
app.put("/admin/password", verifyAdmin, limitLoginAttempts, (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Enter your current and new password" });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ message: "The new password must be at least 8 characters" });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ message: "The new password must be different from the current one" });
  }

  db.query("SELECT * FROM admins WHERE id=?", [req.admin.id], async (err, rows) => {
    if (err) return serverError(res, err);
    if (!rows.length) return res.status(404).json({ message: "Admin account not found" });

    try {
      const valid = await bcrypt.compare(String(currentPassword), rows[0].password);
      if (!valid) {
        res.locals.authFailed = true;
        return res.status(400).json({ message: "Your current password is incorrect" });
      }

      const hashed = await bcrypt.hash(String(newPassword), 10);
      // Other devices are signed out; this one gets a new sign-in
      db.query("UPDATE admins SET password=?, session_version = session_version + 1 WHERE id=?", [hashed, req.admin.id], (err2) => {
        if (err2) return serverError(res, err2);
        const admin = { ...rows[0], session_version: Number(rows[0].session_version || 0) + 1 };
        res.json({ message: "Password changed", token: signAdminToken(admin) });
      });
    } catch (e) {
      serverError(res, e);
    }
  });
});

// Issue a fresh 1-hour token while the admin is active (the admin page calls this)
app.post("/admin/refresh", verifyAdmin, (req, res) => {
  db.query("SELECT id, email, session_version FROM admins WHERE id=?", [req.admin.id], (err, rows) => {
    if (err) return serverError(res, err);
    if (!rows.length) return res.status(401).json({ message: "Admin account not found" });
    res.json({ token: signAdminToken(rows[0]) });
  });
});

/*
   CATEGORIES
*/
// In the order the admin set (Categories page arrows)
app.get("/categories", (req, res) => {
  db.query("SELECT * FROM categories ORDER BY sort_order, name", (err, data) => {
    if (err) return serverError(res, err);
    res.json(data);
  });
});

const cleanCategoryName = (name) => String(name || "").trim().replace(/\s+/g, " ");

app.post("/categories", verifyAdmin, (req, res) => {
  const name = cleanCategoryName(req.body.name);
  if (!name) return res.status(400).json({ message: "Enter a category name" });
  if (name.length > 100) return res.status(400).json({ message: "The name is too long (100 characters max)" });

  // new categories go to the end of the list
  const q = "INSERT INTO categories (name, sort_order) SELECT ?, COALESCE(MAX(sort_order), 0) + 1 FROM categories";
  db.query(q, [name], (err, result) => {
    if (err && err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: `A category called "${name}" already exists` });
    }
    if (err) return serverError(res, err);
    res.json({ id: result.insertId, name });
  });
});

// New order from the admin: { ids: [3, 1, 2, ...] } top to bottom
// (declared before /categories/:id so "order" isn't read as an id)
app.put("/categories/order", verifyAdmin, async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number) : [];
  if (!ids.length || ids.some((id) => !Number.isInteger(id) || id < 1) || new Set(ids).size !== ids.length) {
    return res.status(400).json({ message: "Send the category ids in their new order" });
  }
  try {
    await withTransaction(async (conn) => {
      for (const [i, id] of ids.entries()) {
        await runQuery(conn, "UPDATE categories SET sort_order=? WHERE id=?", [i + 1, id]);
      }
    });
    res.json({ message: "Category order saved" });
  } catch (err) {
    serverError(res, err);
  }
});

// Category picture (home tiles, menus). Either upload one ("image"), or reuse a photo of
// one of the category's own products ({ fromProduct: "<image file>" }). Empty = automatic.
app.put("/categories/:id/image", verifyAdmin, upload.single("image"), processProductUpload, async (req, res) => {
  try {
    const [category] = await runQuery(db, "SELECT image FROM categories WHERE id=?", [req.params.id]);
    if (!category) {
      discardUpload(req);
      return res.status(404).json({ message: "Category not found" });
    }

    let image = req.file ? req.file.filename : null;
    if (!image && req.body.fromProduct) {
      const file = path.basename(String(req.body.fromProduct));
      const [owned] = await runQuery(
        db,
        `SELECT 1 FROM products p WHERE p.category_id=? AND (p.image=? OR EXISTS
           (SELECT 1 FROM product_images g WHERE g.product_id=p.id AND g.image=?)) LIMIT 1`,
        [req.params.id, file, file]
      );
      if (!owned) return res.status(400).json({ message: "Pick a photo of one of this category's products." });
      image = file;
    }
    if (!image) return res.status(400).json({ message: "Choose a picture." });

    // a new picture starts centred and filling the circle
    await runQuery(db, "UPDATE categories SET image=?, pic_zoom=100, pic_x=50, pic_y=50, pic_fill='dark' WHERE id=?", [image, req.params.id]);
    if (category.image && category.image !== image) removeImageIfUnused(category.image);
    res.json({ message: "Category picture saved", image });
  } catch (err) {
    discardUpload(req);
    serverError(res, err);
  }
});

// How the picture sits in its circle (crop tool: zoom, left/right, up/down, what fills the space)
app.put("/categories/:id/framing", verifyAdmin, async (req, res) => {
  const b = req.body || {};
  try {
    const result = await runQuery(db, "UPDATE categories SET pic_zoom=?, pic_x=?, pic_y=?, pic_fill=? WHERE id=?", [
      zoomPercent(b.zoom), percent(b.x ?? 50), percent(b.y ?? 50), fillChoice(b.fill), req.params.id,
    ]);
    if (!result.affectedRows) return res.status(404).json({ message: "Category not found" });
    res.json({ message: "Saved" });
  } catch (err) {
    serverError(res, err);
  }
});

// Back to the automatic picture
app.delete("/categories/:id/image", verifyAdmin, async (req, res) => {
  try {
    const [category] = await runQuery(db, "SELECT image FROM categories WHERE id=?", [req.params.id]);
    if (!category) return res.status(404).json({ message: "Category not found" });
    await runQuery(db, "UPDATE categories SET image=NULL, pic_zoom=100, pic_x=50, pic_y=50, pic_fill='dark' WHERE id=?", [req.params.id]);
    if (category.image) removeImageIfUnused(category.image);
    res.json({ message: "The picture is automatic again" });
  } catch (err) {
    serverError(res, err);
  }
});

// Put a category in a group (parent_id), or take it out (null). One level only: a group can't be
// inside another group, and a category that is a group (has categories in it) stays a main entry.
app.put("/categories/:id/group", verifyAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const parent = req.body?.parent_id === null || req.body?.parent_id === "" ? null : Number(req.body?.parent_id);
  try {
    const [category] = await runQuery(db, "SELECT id FROM categories WHERE id=?", [id]);
    if (!category) return res.status(404).json({ message: "Category not found" });
    if (parent !== null) {
      if (!Number.isInteger(parent) || parent === id) return res.status(400).json({ message: "Choose another group." });
      const [group] = await runQuery(db, "SELECT parent_id FROM categories WHERE id=?", [parent]);
      if (!group) return res.status(400).json({ message: "That group doesn't exist." });
      if (group.parent_id) return res.status(400).json({ message: "That's a category inside a group, so it can't hold others." });
      const [{ n }] = await runQuery(db, "SELECT COUNT(*) AS n FROM categories WHERE parent_id=?", [id]);
      if (Number(n) > 0) return res.status(400).json({ message: "This is a group with categories in it, so it can't go inside another group." });
    }
    await runQuery(db, "UPDATE categories SET parent_id=? WHERE id=?", [parent, id]);
    res.json({ id, parent_id: parent });
  } catch (err) {
    serverError(res, err);
  }
});

app.put("/categories/:id", verifyAdmin, (req, res) => {
  const name = cleanCategoryName(req.body.name);
  if (!name) return res.status(400).json({ message: "Enter a category name" });
  if (name.length > 100) return res.status(400).json({ message: "The name is too long (100 characters max)" });

  db.query("UPDATE categories SET name=? WHERE id=?", [name, req.params.id], (err, result) => {
    if (err && err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: `A category called "${name}" already exists` });
    }
    if (err) return serverError(res, err);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Category not found" });
    res.json({ id: Number(req.params.id), name });
  });
});

// Only empty categories can be deleted (products point to their category)
app.delete("/categories/:id", verifyAdmin, (req, res) => {
  db.query("SELECT COUNT(*) AS n FROM products WHERE category_id=?", [req.params.id], (err, rows) => {
    if (err) return serverError(res, err);
    const n = rows[0].n;
    if (n > 0) {
      return res.status(400).json({
        message: `This category still has ${n} ${n === 1 ? "product" : "products"}. Move or delete them first.`,
      });
    }

    // categories inside a deleted group become main entries again
    db.query("UPDATE categories SET parent_id=NULL WHERE parent_id=?", [req.params.id]);
    db.query("DELETE FROM categories WHERE id=?", [req.params.id], (err2, result) => {
      if (err2) return serverError(res, err2);
      if (result.affectedRows === 0) return res.status(404).json({ message: "Category not found" });
      res.json({ message: "Category deleted" });
    });
  });
});

/*
   PLACES CRUD
*/

// Opening hours from the admin form → clean JSON text (or null = no hours shown).
// undefined = the form didn't send hours, so an edit keeps what was saved.
const PLACE_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const HOURS_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const cleanHours = (raw) => {
  if (raw === undefined) return undefined;
  if (!raw) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const out = {};
  let any = false;
  for (const day of PLACE_DAYS) {
    const slot = data[day];
    if (slot && HOURS_TIME.test(slot.open) && HOURS_TIME.test(slot.close) && slot.open !== slot.close) {
      out[day] = { open: slot.open, close: slot.close };
      any = true;
    } else {
      out[day] = null;
    }
  }
  return any ? JSON.stringify(out) : null;
};

app.get("/places", (req, res) => {
  db.query("SELECT * FROM places", (err, data) => {
    if (err) return serverError(res, err);
    res.json(data);
  });
});

app.get("/places/search/:id", (req, res) => {
  db.query("SELECT * FROM places WHERE id=?", [req.params.id], (err, data) => {
    if (err) return serverError(res, err);
    res.json(data);
  });
});

app.post("/places", verifyAdmin, upload.single("image"), (req, res) => {
  const { name, address, tel, lat, lng } = req.body;
  const image = req.file ? req.file.filename : null;
  const hours = cleanHours(req.body.hours) ?? null;

  const q = "INSERT INTO places (name,address,tel,image,lat,lng,hours) VALUES (?,?,?,?,?,?,?)";

  db.query(q, [name, address, tel, image, lat || null, lng || null, hours], (err, data) => {
    if (err) {
      discardUpload(req);
      return serverError(res, err);
    }
    res.json(data);
  });
});

app.post("/places/modify/:id", verifyAdmin, upload.single("image"), (req, res) => {
  const { name, address, tel, existingImage, lat, lng } = req.body;
  const image = req.file ? req.file.filename : existingImage;
  const hours = cleanHours(req.body.hours);

  const q =
    "UPDATE places SET name=?, address=?, tel=?, image=?, lat=?, lng=?" +
    (hours === undefined ? "" : ", hours=?") +
    " WHERE id=?";

  getCurrentImage("places", req.params.id, (imgErr, oldImage) => {
    if (imgErr) {
      discardUpload(req);
      return serverError(res, imgErr);
    }

    db.query(
      q,
      [name, address, tel, image, lat || null, lng || null, ...(hours === undefined ? [] : [hours]), req.params.id],
      (err) => {
        if (err) {
          discardUpload(req);
          return serverError(res, err);
        }
        if (oldImage !== image) removeImageIfUnused(oldImage);
        res.json({ message: "Place updated ✅" });
      }
    );
  });
});

app.delete("/places/:id", verifyAdmin, (req, res) => {
  getCurrentImage("places", req.params.id, (imgErr, oldImage) => {
    if (imgErr) return serverError(res, imgErr);

    db.query("DELETE FROM places WHERE id=?", [req.params.id], (err) => {
      if (err) return serverError(res, err);
      removeImageIfUnused(oldImage);
      res.json({ message: "Place deleted ✅" });
    });
  });
});

/*
   HOME PAGE BANNERS (Admin → Banners)
*/
const cleanText = (value, max) => String(value || "").trim().replace(/\s+/g, " ").slice(0, max);

// Button link: a page on this site ("/shop?category=Monitors", "/product/12") or a full https:// address
const cleanLink = (value) => {
  const link = String(value || "").trim();
  if (/^\/(?!\/)\S*$/.test(link) || /^https?:\/\/\S+$/i.test(link)) return link.slice(0, 255);
  return null;
};

const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
const percent = (value) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 50;
};
// Crop tool: zoom in % of "fills the box" (10 = far out, 300 = close in) and what shows around a zoomed-out picture
const zoomPercent = (value) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(300, Math.max(10, n)) : 100;
};
const fillChoice = (value) => pick(value, ["dark", "blur"], "dark");

const cleanDay = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : null);

const bannerFields = (body) => ({
  eyebrow: cleanText(body.eyebrow, 60) || null,
  title: cleanText(body.title, 120),
  subtitle: cleanText(body.subtitle, 220) || null,
  button_text: cleanText(body.button_text, 40) || "Shop now",
  link: cleanLink(body.link),
  active: body.active === "0" || body.active === "false" || body.active === false ? 0 : 1,
  // design: where the text sits, its color, the fade behind it, the spot that must stay visible
  text_align: pick(body.text_align, ["left", "center", "right"], "left"),
  text_color: pick(body.text_color, ["light", "dark"], "light"),
  shade: pick(body.shade, ["none", "light", "medium", "strong"], "medium"),
  focus_x: percent(body.focus_x ?? 50),
  focus_y: percent(body.focus_y ?? 50),
  img_zoom: zoomPercent(body.img_zoom ?? 100),
  img_fill: fillChoice(body.img_fill),
  // optional schedule (e.g. a weekend sale)
  starts_on: cleanDay(body.starts_on),
  ends_on: cleanDay(body.ends_on),
});

const bannerError = (fields) =>
  !fields.title
    ? "Enter a headline."
    : !fields.link
    ? "Enter where the button goes: a page like /shop or a full https:// link."
    : fields.starts_on && fields.ends_on && fields.ends_on < fields.starts_on
    ? "The end date is before the start date."
    : "";

const BANNER_COLUMNS = "eyebrow, title, subtitle, button_text, link, active, text_align, text_color, shade, focus_x, focus_y, img_zoom, img_fill, starts_on, ends_on";
const bannerValues = (f) => [
  f.eyebrow, f.title, f.subtitle, f.button_text, f.link, f.active,
  f.text_align, f.text_color, f.shade, f.focus_x, f.focus_y, f.img_zoom, f.img_fill, f.starts_on, f.ends_on,
];

// Shown on the home page, in the admin's order (only on their scheduled days, if any)
app.get("/banners", (req, res) => {
  db.query(
    `SELECT id, image, image_mobile, eyebrow, title, subtitle, button_text, link, text_align, text_color, shade, focus_x, focus_y, img_zoom, img_fill
     FROM banners
     WHERE section_id IS NULL AND active=1 AND (starts_on IS NULL OR starts_on <= CURDATE()) AND (ends_on IS NULL OR ends_on >= CURDATE())
     ORDER BY sort_order, id`,
    (err, rows) => {
      if (err) return serverError(res, err);
      res.json(rows);
    }
  );
});

app.get("/admin/banners", verifyAdmin, (req, res) => {
  // dates as plain YYYY-MM-DD, so the admin form shows the day that was picked
  const sql = `SELECT *, DATE_FORMAT(starts_on, '%Y-%m-%d') AS starts_on, DATE_FORMAT(ends_on, '%Y-%m-%d') AS ends_on,
    (starts_on IS NOT NULL AND starts_on > CURDATE()) AS not_started, (ends_on IS NOT NULL AND ends_on < CURDATE()) AS has_ended
    FROM banners WHERE section_id IS NULL ORDER BY sort_order, id`;
  db.query(sql, (err, rows) => {
    if (err) return serverError(res, err);
    res.json(rows);
  });
});

// The banner picture, plus an optional picture made for phones (shown there instead of a crop of the wide one)
const bannerUpload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_SIZE, files: 2 },
  fileFilter: imageFileFilter,
}).fields([{ name: "image", maxCount: 1 }, { name: "image_mobile", maxCount: 1 }]);
const uploaded = (req, name) => req.files?.[name]?.[0] || null;

app.post("/banners", verifyAdmin, bannerUpload, processBannerUploads, async (req, res) => {
  const fields = bannerFields(req.body);
  const image = uploaded(req, "image");
  const problem = !image ? "Choose a banner image." : bannerError(fields);
  if (problem) {
    discardUpload(req);
    return res.status(400).json({ message: problem });
  }
  try {
    const result = await runQuery(
      db,
      `INSERT INTO banners (image, image_mobile, ${BANNER_COLUMNS}, sort_order)
       SELECT ?, ?, ${BANNER_COLUMNS.split(", ").map(() => "?").join(", ")}, COALESCE(MAX(sort_order), 0) + 1 FROM banners WHERE section_id IS NULL`,
      [image.filename, uploaded(req, "image_mobile")?.filename || null, ...bannerValues(fields)]
    );
    res.json({ message: "Banner added", id: result.insertId });
  } catch (err) {
    discardUpload(req);
    serverError(res, err);
  }
});

// New order: { ids: [3, 1, 2] } top to bottom (declared before /banners/:id)
app.put("/banners/order", verifyAdmin, async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number) : [];
  if (!ids.length || ids.some((id) => !Number.isInteger(id) || id < 1) || new Set(ids).size !== ids.length) {
    return res.status(400).json({ message: "Send the banner ids in their new order" });
  }
  try {
    await withTransaction(async (conn) => {
      for (const [i, id] of ids.entries()) await runQuery(conn, "UPDATE banners SET sort_order=? WHERE id=?", [i + 1, id]);
    });
    res.json({ message: "Banner order saved" });
  } catch (err) {
    serverError(res, err);
  }
});

// Show or hide a banner without deleting it
app.put("/banners/:id/active", verifyAdmin, (req, res) => {
  const active = req.body.active ? 1 : 0;
  db.query("UPDATE banners SET active=? WHERE id=?", [active, req.params.id], (err, result) => {
    if (err) return serverError(res, err);
    if (!result.affectedRows) return res.status(404).json({ message: "Banner not found" });
    res.json({ message: active ? "Banner is live" : "Banner hidden", active });
  });
});

app.put("/banners/:id", verifyAdmin, bannerUpload, processBannerUploads, async (req, res) => {
  const fields = bannerFields(req.body);
  const problem = bannerError(fields);
  if (problem) {
    discardUpload(req);
    return res.status(400).json({ message: problem });
  }
  try {
    const [current] = await runQuery(db, "SELECT image, image_mobile FROM banners WHERE id=?", [req.params.id]);
    if (!current) {
      discardUpload(req);
      return res.status(404).json({ message: "Banner not found" });
    }
    const image = uploaded(req, "image")?.filename || current.image;
    // phone picture: a new one, removed ("remove_image_mobile"), or unchanged
    const imageMobile = uploaded(req, "image_mobile")?.filename || (req.body.remove_image_mobile === "1" ? null : current.image_mobile);
    await runQuery(
      db,
      `UPDATE banners SET image=?, image_mobile=?, ${BANNER_COLUMNS.split(", ").map((c) => `${c}=?`).join(", ")} WHERE id=?`,
      [image, imageMobile, ...bannerValues(fields), req.params.id]
    );
    if (current.image !== image) removeImageIfUnused(current.image);
    if (current.image_mobile && current.image_mobile !== imageMobile) removeImageIfUnused(current.image_mobile);
    res.json({ message: "Banner updated" });
  } catch (err) {
    discardUpload(req);
    serverError(res, err);
  }
});

app.delete("/banners/:id", verifyAdmin, async (req, res) => {
  try {
    const [banner] = await runQuery(db, "SELECT image, image_mobile FROM banners WHERE id=?", [req.params.id]);
    if (!banner) return res.status(404).json({ message: "Banner not found" });
    await runQuery(db, "DELETE FROM banners WHERE id=?", [req.params.id]);
    removeImageIfUnused(banner.image);
    if (banner.image_mobile) removeImageIfUnused(banner.image_mobile);
    res.json({ message: "Banner deleted" });
  } catch (err) {
    serverError(res, err);
  }
});

/*
   PROMO SECTIONS (Admin → Banners → Promo sections)
   A row of 1-3 promo banners between the home page sections. Each slot is a banners row
   (placement 'promo', section_id, slot), so it has the same design settings and pictures.
   The admin form sends "data" (JSON) plus the new pictures as image_0 … image_3.
*/
const PROMO_LAYOUTS = { wide: 1, halves: 2, thirds: 3, grid: 4 }; // grid = 4 squares, 2 × 2 (Apple style)
const PROMO_POSITIONS = ["after_trust", "after_categories", "after_best", "after_new", "bottom"];
const promoUpload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_SIZE, files: 4 },
  fileFilter: imageFileFilter,
}).fields([{ name: "image_0" }, { name: "image_1" }, { name: "image_2" }, { name: "image_3" }]);

const promoPosition = (value) => {
  const v = String(value || "");
  return PROMO_POSITIONS.includes(v) || /^cat:.{1,60}$/.test(v) ? v : "after_new";
};

// A slot's text is optional (the picture may already say it all); its link is not
const slotFields = (body = {}) => ({
  eyebrow: cleanText(body.eyebrow, 60) || null,
  title: cleanText(body.title, 120),
  subtitle: cleanText(body.subtitle, 220) || null,
  button_text: cleanText(body.button_text, 40),
  link: cleanLink(body.link),
  text_align: pick(body.text_align, ["left", "center", "right"], "left"),
  text_color: pick(body.text_color, ["light", "dark"], "light"),
  shade: pick(body.shade, ["none", "light", "medium", "strong"], "medium"),
  focus_x: percent(body.focus_x ?? 50),
  focus_y: percent(body.focus_y ?? 50),
  img_zoom: zoomPercent(body.img_zoom ?? 100),
  img_fill: fillChoice(body.img_fill),
});

const SLOT_COLUMNS = "eyebrow, title, subtitle, button_text, link, text_align, text_color, shade, focus_x, focus_y, img_zoom, img_fill";
const slotValues = (f) => [
  f.eyebrow, f.title, f.subtitle, f.button_text, f.link, f.text_align, f.text_color, f.shade, f.focus_x, f.focus_y, f.img_zoom, f.img_fill,
];

// Sections with their slots, in the admin's order. live=true: only what customers should see today.
const loadPromos = async (live) => {
  const sections = await runQuery(
    db,
    `SELECT id, layout, position, active, DATE_FORMAT(starts_on, '%Y-%m-%d') AS starts_on, DATE_FORMAT(ends_on, '%Y-%m-%d') AS ends_on,
            (starts_on IS NOT NULL AND starts_on > CURDATE()) AS not_started, (ends_on IS NOT NULL AND ends_on < CURDATE()) AS has_ended
       FROM promo_sections
      ${live ? "WHERE active=1 AND (starts_on IS NULL OR starts_on <= CURDATE()) AND (ends_on IS NULL OR ends_on >= CURDATE())" : ""}
      ORDER BY sort_order, id`
  );
  if (!sections.length) return [];
  const slots = await runQuery(
    db,
    `SELECT id, section_id, slot, image, ${SLOT_COLUMNS} FROM banners WHERE section_id IN (?) ORDER BY slot`,
    [sections.map((x) => x.id)]
  );
  return sections
    .map((x) => ({
      ...x,
      active: Number(x.active) === 1,
      not_started: Number(x.not_started) === 1,
      has_ended: Number(x.has_ended) === 1,
      slots: slots.filter((b) => b.section_id === x.id),
    }))
    .filter((x) => !live || x.slots.length === PROMO_LAYOUTS[x.layout]);
};

app.get("/promos", async (req, res) => {
  try {
    const promos = await loadPromos(true);
    res.json(promos.map(({ id, layout, position, slots }) => ({ id, layout, position, slots })));
  } catch (err) {
    serverError(res, err);
  }
});

app.get("/admin/promos", verifyAdmin, async (req, res) => {
  try {
    res.json(await loadPromos(false));
  } catch (err) {
    serverError(res, err);
  }
});

// Create (no id) or replace (id) a section and all its slots in one go
const savePromo = async (req, res, id) => {
  let data;
  try {
    data = JSON.parse(req.body?.data || "{}");
  } catch {
    data = {};
  }
  const layout = PROMO_LAYOUTS[data.layout] ? data.layout : "halves";
  const count = PROMO_LAYOUTS[layout];
  const section = {
    layout,
    position: promoPosition(data.position),
    active: data.active === false ? 0 : 1,
    starts_on: cleanDay(data.starts_on),
    ends_on: cleanDay(data.ends_on),
  };
  const slots = Array.from({ length: count }, (_, i) => slotFields(Array.isArray(data.slots) ? data.slots[i] : {}));
  const files = Array.from({ length: count }, (_, i) => req.files?.[`image_${i}`]?.[0] || null);

  try {
    const old = id ? await runQuery(db, "SELECT slot, image FROM banners WHERE section_id=?", [id]) : [];
    if (id && !(await runQuery(db, "SELECT id FROM promo_sections WHERE id=?", [id])).length) {
      discardUpload(req);
      return res.status(404).json({ message: "Promo section not found" });
    }
    const images = slots.map((_, i) => files[i]?.filename || old.find((o) => o.slot === i)?.image || null);

    const missing = images.findIndex((img) => !img);
    const badLink = slots.findIndex((f) => !f.link);
    const problem =
      missing >= 0
        ? `Add a picture to banner ${missing + 1}.`
        : badLink >= 0
        ? `Banner ${badLink + 1}: choose where it goes (a page like /shop or a full https:// link).`
        : section.starts_on && section.ends_on && section.ends_on < section.starts_on
        ? "The end date is before the start date."
        : "";
    if (problem) {
      discardUpload(req);
      return res.status(400).json({ message: problem });
    }

    const sectionId = await withTransaction(async (conn) => {
      let sid = id;
      if (sid) {
        await runQuery(conn, "UPDATE promo_sections SET layout=?, position=?, active=?, starts_on=?, ends_on=? WHERE id=?", [
          section.layout, section.position, section.active, section.starts_on, section.ends_on, sid,
        ]);
        await runQuery(conn, "DELETE FROM banners WHERE section_id=?", [sid]);
      } else {
        const result = await runQuery(
          conn,
          `INSERT INTO promo_sections (layout, position, active, starts_on, ends_on, sort_order)
           SELECT ?, ?, ?, ?, ?, COALESCE(MAX(sort_order), 0) + 1 FROM promo_sections`,
          [section.layout, section.position, section.active, section.starts_on, section.ends_on]
        );
        sid = result.insertId;
      }
      for (const [i, f] of slots.entries()) {
        await runQuery(
          conn,
          `INSERT INTO banners (image, ${SLOT_COLUMNS}, placement, section_id, slot, active, sort_order)
           VALUES (?, ${SLOT_COLUMNS.split(", ").map(() => "?").join(", ")}, 'promo', ?, ?, 1, 0)`,
          [images[i], ...slotValues(f), sid, i]
        );
      }
      return sid;
    });

    // pictures that were replaced, or belonged to slots the new layout dropped
    old.filter((o) => !images.includes(o.image)).forEach((o) => removeImageIfUnused(o.image));
    res.json({ message: id ? "Promo section updated" : "Promo section added", id: sectionId });
  } catch (err) {
    discardUpload(req);
    serverError(res, err);
  }
};

app.post("/admin/promos", verifyAdmin, promoUpload, processPromoUploads, (req, res) => savePromo(req, res, null));

// New order: { ids: [3, 1, 2] } (declared before /admin/promos/:id)
app.put("/admin/promos/order", verifyAdmin, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
  if (!ids.length) return res.status(400).json({ message: "Send the section ids in their new order" });
  try {
    await withTransaction(async (conn) => {
      for (const [i, sid] of ids.entries()) await runQuery(conn, "UPDATE promo_sections SET sort_order=? WHERE id=?", [i + 1, sid]);
    });
    res.json({ message: "Order saved" });
  } catch (err) {
    serverError(res, err);
  }
});

app.put("/admin/promos/:id/active", verifyAdmin, async (req, res) => {
  try {
    const result = await runQuery(db, "UPDATE promo_sections SET active=? WHERE id=?", [req.body?.active ? 1 : 0, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: "Promo section not found" });
    res.json({ message: "Saved" });
  } catch (err) {
    serverError(res, err);
  }
});

app.put("/admin/promos/:id", verifyAdmin, promoUpload, processPromoUploads, (req, res) => savePromo(req, res, Number(req.params.id)));

app.delete("/admin/promos/:id", verifyAdmin, async (req, res) => {
  try {
    const old = await runQuery(db, "SELECT image FROM banners WHERE section_id=?", [req.params.id]);
    const result = await withTransaction(async (conn) => {
      await runQuery(conn, "DELETE FROM banners WHERE section_id=?", [req.params.id]);
      return runQuery(conn, "DELETE FROM promo_sections WHERE id=?", [req.params.id]);
    });
    if (!result.affectedRows) return res.status(404).json({ message: "Promo section not found" });
    old.forEach((o) => removeImageIfUnused(o.image));
    res.json({ message: "Promo section deleted" });
  } catch (err) {
    serverError(res, err);
  }
});

/*
   PRODUCTS CRUD
*/
// The shop only gets products that are shown; the admin list asks for all of them (?all=1)
app.get("/products", (req, res) => {
  const all = req.query.all === "1" && isAdminRequest(req);
  const q = `
    SELECT p.*, c.name AS category_name, c.sort_order AS category_order, c.image AS category_image,
           c.pic_zoom AS category_pic_zoom, c.pic_x AS category_pic_x, c.pic_y AS category_pic_y, c.pic_fill AS category_pic_fill,
           pc.name AS category_parent, pc.sort_order AS category_parent_order, pc.image AS category_parent_image,
           pc.pic_zoom AS category_parent_pic_zoom, pc.pic_x AS category_parent_pic_x, pc.pic_y AS category_parent_pic_y,
           pc.pic_fill AS category_parent_pic_fill${SALE_COLUMNS}
    FROM products p
    JOIN categories c ON p.category_id = c.id
    LEFT JOIN categories pc ON pc.id = c.parent_id
    ${all ? "" : "WHERE p.active = 1"}
    ORDER BY p.id DESC
  `;

  db.query(q, (err, data) => {
    if (err) return serverError(res, err);
    res.json(data);
  });
});

// One product with its category (product page)
app.get("/products/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(404).json({ message: "Product not found" });

  const q = `
    SELECT p.*, c.name AS category_name, pc.name AS category_parent${SALE_COLUMNS}
    FROM products p
    JOIN categories c ON p.category_id = c.id
    LEFT JOIN categories pc ON pc.id = c.parent_id
    WHERE p.id = ?
  `;
  db.query(q, [id], (err, rows) => {
    if (err) return serverError(res, err);
    // a hidden product's page is only for the admin
    if (!rows.length || (!rows[0].active && !isAdminRequest(req))) {
      return res.status(404).json({ message: "Product not found" });
    }

    db.query(
      "SELECT id, image FROM product_images WHERE product_id=? ORDER BY sort_order, id",
      [id],
      (err2, images) => {
        if (err2) return serverError(res, err2);
        res.json({ ...rows[0], images });
      }
    );
  });
});

app.get("/products/search/:id", (req, res) => {
  db.query("SELECT * FROM products WHERE id=?", [req.params.id], (err, data) => {
    if (err) return serverError(res, err);
    res.json(data);
  });
});

// Brand (NVIDIA, ASUS, Logitech...): used by the shop's brand filter
const cleanBrand = (text) => String(text || "").trim().replace(/\s+/g, " ").slice(0, 60) || null;

// Specs: one per line ("Memory: 24 GB"), blank lines dropped, kept short
const cleanSpecs = (text) =>
  String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 40)
    .join("\n")
    .slice(0, 4000) || null;

// Ids of extra photos to remove, sent as a JSON list
const parseIdList = (value) => {
  try {
    const list = JSON.parse(value || "[]");
    return Array.isArray(list) ? list.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
  } catch {
    return [];
  }
};

// Extra photos go after the ones the product already has
async function addGalleryImages(conn, productId, files) {
  if (!files?.length) return;
  const [row] = await runQuery(conn, "SELECT COALESCE(MAX(sort_order), 0) AS last FROM product_images WHERE product_id=?", [productId]);
  await runQuery(
    conn,
    "INSERT INTO product_images (product_id, image, sort_order) VALUES ?",
    [files.map((file, i) => [productId, file.filename, row.last + i + 1])]
  );
}

// "Show in the shop" from the product form: 1 or 0 (null = not sent, keep it as it is)
const activeFlag = (value) =>
  value === undefined || value === null || value === "" ? null : value === "0" || value === "false" || value === false ? 0 : 1;

// Sale: the old price only counts when it's higher than the price; the sale can end on a day
const saleFields = (body, price) => {
  const old = Math.round(Number(String(body.old_price ?? "").replace(/[$,]/g, "")) * 100) / 100;
  const onSale = Number.isFinite(old) && old > Number(price);
  return { old_price: onSale ? old : null, sale_ends: onSale ? cleanDay(body.sale_ends) : null };
};

// Shown on the shop: is the sale on today? (the old price is higher and the end day hasn't passed)
const SALE_COLUMNS = `,
  (p.old_price > p.price AND (p.sale_ends IS NULL OR p.sale_ends >= CURDATE())) AS on_sale,
  DATE_FORMAT(p.sale_ends, '%Y-%m-%d') AS sale_ends`;

/*
   SALES THAT END: on the day after "Sale ends" the normal price (the old price) comes back and
   the sale is cleared, so customers stop getting the discount. Checked at start and hourly.
*/
const endFinishedSales = async () => {
  try {
    const result = await runQuery(
      db,
      "UPDATE products SET price = old_price, old_price = NULL, sale_ends = NULL WHERE sale_ends IS NOT NULL AND sale_ends < CURDATE() AND old_price > price"
    );
    // a leftover end date without a real old price is just cleared
    await runQuery(db, "UPDATE products SET old_price = NULL, sale_ends = NULL WHERE sale_ends < CURDATE()");
    if (result.affectedRows) console.log(`🏷️ ${result.affectedRows} sale(s) ended: normal prices are back`);
  } catch (err) {
    console.error("❌ Could not end finished sales:", err.message);
  }
};
setTimeout(endFinishedSales, 5 * 1000);
setInterval(endFinishedSales, 60 * 60 * 1000).unref();

const PRODUCT_FIELDS = [
  { name: "image", maxCount: 1 },
  { name: "gallery", maxCount: MAX_GALLERY },
];

// processProductUploads: every product photo gets the same size and margin
app.post("/products", verifyAdmin, productUpload.fields(PRODUCT_FIELDS), processProductUploads, async (req, res) => {
  const { category_id, name, price, label, description, stock_quantity, specs, brand } = req.body;
  let image = req.file ? req.file.filename : null;

  try {
    // "Duplicate product": reuse the original's photos, but only ones that really belong to it
    let copiedGallery = [];
    const sourceId = Number(req.body.copyFrom);
    if (Number.isInteger(sourceId) && sourceId > 0) {
      const [source] = await runQuery(db, "SELECT image FROM products WHERE id=?", [sourceId]);
      if (source && !image && req.body.existingImage && req.body.existingImage === source.image) image = source.image;
      const keep = parseIdList(req.body.copyGallery);
      if (source && keep.length) {
        const rows = await runQuery(
          db,
          "SELECT image FROM product_images WHERE product_id=? AND id IN (?) ORDER BY sort_order, id",
          [sourceId, keep]
        );
        copiedGallery = rows.map((r) => r.image);
      }
    }

    const sale = saleFields(req.body, price);
    const result = await runQuery(
      db,
      "INSERT INTO products (category_id,name,brand,price,old_price,sale_ends,image,label,description,stock_quantity,specs,active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      [category_id, name, cleanBrand(brand), price, sale.old_price, sale.sale_ends, image, label || null, description, Number(stock_quantity) || 0, cleanSpecs(specs), activeFlag(req.body.active) ?? 1]
    );
    if (copiedGallery.length) {
      await runQuery(db, "INSERT INTO product_images (product_id, image, sort_order) VALUES ?", [
        copiedGallery.map((file, i) => [result.insertId, file, i + 1]),
      ]);
    }
    await addGalleryImages(db, result.insertId, req.files?.gallery);
    res.json({ message: "Product added ✅", id: result.insertId });
  } catch (err) {
    discardUpload(req);
    serverError(res, err);
  }
});

app.delete("/products/:id", verifyAdmin, async (req, res) => {
  try {
    const [product] = await runQuery(db, "SELECT image FROM products WHERE id=?", [req.params.id]);
    const gallery = await runQuery(db, "SELECT image FROM product_images WHERE product_id=?", [req.params.id]);

    // extra photos are removed with the product (ON DELETE CASCADE)
    await runQuery(db, "DELETE FROM products WHERE id=?", [req.params.id]);
    if (product) removeImageIfUnused(product.image);
    gallery.forEach((g) => removeImageIfUnused(g.image));
    res.json({ message: "Product deleted ✅" });
  } catch (err) {
    serverError(res, err);
  }
});

app.post("/products/modify/:id", verifyAdmin, productUpload.fields(PRODUCT_FIELDS), processProductUploads, async (req, res) => {
  const { category_id, name, price, label, description, existingImage, stock_quantity, specs, brand } = req.body;
  const image = req.file ? req.file.filename : existingImage;
  const productId = req.params.id;
  const removeIds = parseIdList(req.body.removeGallery);

  try {
    const [current] = await runQuery(db, "SELECT image FROM products WHERE id=?", [productId]);
    if (!current) {
      discardUpload(req);
      return res.status(404).json({ message: "Product not found" });
    }

    let removed = [];
    const sale = saleFields(req.body, price);
    await withTransaction(async (conn) => {
      await runQuery(
        conn,
        `UPDATE products
         SET category_id=?, name=?, brand=?, price=?, old_price=?, sale_ends=?, image=?, label=?, description=?, stock_quantity=?, specs=?, active=COALESCE(?, active)
         WHERE id=?`,
        [category_id, name, cleanBrand(brand), price, sale.old_price, sale.sale_ends, image, label || null, description, Number(stock_quantity) || 0, cleanSpecs(specs), activeFlag(req.body.active), productId]
      );

      if (removeIds.length) {
        removed = await runQuery(conn, "SELECT image FROM product_images WHERE product_id=? AND id IN (?)", [productId, removeIds]);
        await runQuery(conn, "DELETE FROM product_images WHERE product_id=? AND id IN (?)", [productId, removeIds]);
      }
      await addGalleryImages(conn, productId, req.files?.gallery);
    });

    if (current.image !== image) removeImageIfUnused(current.image);
    removed.forEach((g) => removeImageIfUnused(g.image));
    res.json({ message: "Product updated ✅" });
  } catch (err) {
    discardUpload(req);
    serverError(res, err);
  }
});

/*
   ORDERS / CHECKOUT
*/

/*
   USER CHECKOUT - LOGIN REQUIRED
*/
/*
   CHECKOUT SETTINGS
   Delivery fee comes from DELIVERY_FEE in .env (default $5).
*/
const DELIVERY_FEE = Number(process.env.DELIVERY_FEE ?? 5);
// Card payments come back once an online payment provider (e.g. Whish, Areeba) is connected
const PAYMENT_METHODS = { cash: "Cash on delivery" };

app.get("/checkout-info", (req, res) => {
  res.json({
    delivery_fee: DELIVERY_FEE,
    payment_methods: Object.entries(PAYMENT_METHODS).map(([id, label]) => ({ id, label })),
  });
});

app.post("/orders", verifyUser, limitRequests(10, 60, "Too many orders in a short time. Please call us if you need help.", { perAccount: true }), async (req, res) => {
  const { customer_name, customer_phone, customer_address, items, payment_method, save_details } = req.body;

  if (!PAYMENT_METHODS[payment_method]) {
    return res.status(400).json({ message: "Please choose how you'd like to pay." });
  }

  if (
    ![customer_name, customer_phone, customer_address].every(
      (v) => typeof v === "string" && v.trim()
    )
  ) {
    return res.status(400).json({ message: "Please fill name, phone, and address." });
  }

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: "Cart empty" });
  }

  // Only trust product id + quantity from the browser; merge duplicate ids
  const requestedQty = new Map();
  for (const it of items) {
    const id = Number(it.id);
    const qty = Number(it.qty);

    if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 1) {
      return res.status(400).json({ message: "Invalid item or quantity" });
    }

    requestedQty.set(id, (requestedQty.get(id) || 0) + qty);
  }

  const productIds = [...requestedQty.keys()];

  let conn;
  let orderId;
  let orderItems;
  let total;

  // One transaction: lock product rows, check stock, save order, subtract stock.
  // FOR UPDATE makes concurrent checkouts for the same product wait their turn,
  // so two buyers can't both pass the stock check for the last item.
  try {
    conn = await new Promise((resolve, reject) =>
      db.getConnection((err, c) => (err ? reject(err) : resolve(c)))
    );
    await runQuery(conn, "START TRANSACTION");

    const productsStock = await runQuery(
      conn,
      "SELECT id, name, price, stock_quantity, image, active FROM products WHERE id IN (?) FOR UPDATE",
      [productIds]
    );

    orderItems = [];

    for (const [id, qty] of requestedQty) {
      const product = productsStock.find((p) => Number(p.id) === id);

      if (!product) {
        await runQuery(conn, "ROLLBACK");
        return res.status(400).json({ message: `Product #${id} not found` });
      }

      if (!product.active) {
        await runQuery(conn, "ROLLBACK");
        return res.status(400).json({ message: `${product.name} isn't available right now. Please remove it from your cart.` });
      }

      if (Number(product.stock_quantity) < qty) {
        await runQuery(conn, "ROLLBACK");
        return res.status(400).json({
          message: `${product.name} is out of stock or not enough quantity available`,
        });
      }

      orderItems.push({
        id,
        name: product.name,
        price: Number(product.price),
        qty,
        image: product.image, // for the confirmation email
      });
    }

    const subtotal = orderItems.reduce((sum, it) => sum + it.price * it.qty, 0);
    total = subtotal + DELIVERY_FEE;

    const result = await runQuery(
      conn,
      "INSERT INTO orders (user_id, customer_name, customer_phone, customer_address, total, delivery_fee, payment_method) VALUES (?,?,?,?,?,?,?)",
      [req.user.id, customer_name, customer_phone, customer_address, total, DELIVERY_FEE, payment_method]
    );
    orderId = result.insertId;

    await runQuery(
      conn,
      "INSERT INTO order_items (order_id,product_id,product_name,price,quantity) VALUES ?",
      [orderItems.map((it) => [orderId, it.id, it.name, it.price, it.qty])]
    );

    for (const it of orderItems) {
      await runQuery(
        conn,
        "UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?",
        [it.qty, it.id]
      );
    }

    await runQuery(conn, "COMMIT");
  } catch (err) {
    if (conn) await runQuery(conn, "ROLLBACK").catch(() => {});
    console.error("❌ Checkout failed:", err);
    return res.status(500).json({ message: "Could not place order, please try again" });
  } finally {
    if (conn) conn.release();
  }

  // "Save these details for next time": fill in checkout automatically next time
  if (save_details === true) {
    runQuery(db, "UPDATE users SET phone=?, address=? WHERE id=?", [
      String(customer_phone).trim().slice(0, 30),
      String(customer_address).trim().slice(0, 255),
      req.user.id,
    ]).catch((e) => console.error("❌ Could not save delivery details:", e));
  }

  // Confirmation email (with product photos)
  try {
    const email = buildOrderEmail({
      kind: "confirmation",
      order: {
        id: orderId,
        customer_name,
        customer_phone,
        customer_address,
        total,
        delivery_fee: DELIVERY_FEE,
        payment_method,
        created_at: new Date(),
      },
      items: orderItems,
      siteUrl: SITE_URL,
      imagesDir,
    });
    await transporter.sendMail({
      from: `"MegaTech" <${process.env.EMAIL_USER}>`,
      to: req.user.email,
      ...email,
    });
    console.log(`✅ Confirmation email sent to ${req.user.email}`);
  } catch (emailErr) {
    console.error("❌ Email sending failed:", emailErr);
    // order still succeeds even if email fails
  }

  notifyAdminOfOrder(orderId, "new");

  res.json({
    message: "Order placed ✅",
    order_id: orderId,
    user_id: req.user.id,
    total,
  });
});

/*
   ADMIN ORDERS
*/
app.get("/orders", verifyAdmin, (req, res) => {
  const q = `
    SELECT 
      orders.id,
      orders.user_id,
      orders.customer_name,
      orders.customer_phone,
      orders.customer_address,
      orders.total,
      orders.status,
      orders.created_at,
      users.email AS user_email,
      users.name AS user_name
    FROM orders
    JOIN users ON orders.user_id = users.id
    ORDER BY orders.id DESC
  `;

  db.query(q, (err, data) => {
    if (err) return serverError(res, err);
    res.json(data);
  });
});
// Email the shop owner about a new or cancelled order (ADMIN_NOTIFY_EMAIL in .env, else the shop's own address).
// Never fails the order: a failed email is only logged.
async function notifyAdminOfOrder(orderId, kind) {
  const to = process.env.ADMIN_NOTIFY_EMAIL || process.env.EMAIL_USER;
  if (!to) return;
  try {
    const [order] = await runQuery(
      db,
      `SELECT orders.*, users.email AS user_email FROM orders LEFT JOIN users ON users.id = orders.user_id WHERE orders.id=?`,
      [orderId]
    );
    if (!order) return;
    const items = await runQuery(
      db,
      "SELECT product_name AS name, price, quantity AS qty FROM order_items WHERE order_id=?",
      [orderId]
    );
    const email = buildAdminOrderEmail({
      kind,
      order,
      items,
      customerEmail: order.user_email,
      adminUrl: `${SITE_URL}/orders/${orderId}`,
    });
    await transporter.sendMail({ from: `"MegaTech" <${process.env.EMAIL_USER}>`, to, ...email });
    console.log(`✅ Admin notified about order #${orderId} (${kind})`);
  } catch (err) {
    console.error("❌ Admin order email failed:", err);
  }
}

// Email the customer about a status change (same design as the confirmation, with the items).
// Returns true when the email went out; a failed email never fails the status change.
async function sendStatusEmail(orderId, status) {
  try {
    const [order] = await runQuery(
      db,
      `SELECT orders.id, orders.customer_name, orders.customer_phone, orders.customer_address,
              orders.total, orders.delivery_fee, orders.payment_method, orders.status,
              orders.created_at, users.email
       FROM orders
       JOIN users ON orders.user_id = users.id
       WHERE orders.id = ?`,
      [orderId]
    );
    if (!order) return false;

    const items = await runQuery(
      db,
      `SELECT order_items.product_name AS name, order_items.price, order_items.quantity AS qty,
              products.image
       FROM order_items
       LEFT JOIN products ON products.id = order_items.product_id
       WHERE order_items.order_id = ?`,
      [orderId]
    );
    const email = buildOrderEmail({ kind: status, order, items, siteUrl: SITE_URL, imagesDir });
    await transporter.sendMail({ from: `"MegaTech" <${process.env.EMAIL_USER}>`, to: order.email, ...email });
    console.log(`✅ Status email sent to ${order.email}`);
    return true;
  } catch (err) {
    console.error("❌ Status email failed:", err);
    return false;
  }
}

app.put("/orders/:id/status", verifyAdmin, async (req, res) => {
  const { status } = req.body;
  const orderId = req.params.id;

  if (!status) {
    return res.status(400).json({ message: "Status is required" });
  }

  const allowedStatuses = ["pending", "processing", "done", "cancelled"];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  // Change status and fix stock together: cancelling puts items back in stock,
  // and a cancelled order can't be reopened (its stock was already returned)
  try {
    await withTransaction(async (conn) => {
      const rows = await runQuery(conn, "SELECT status FROM orders WHERE id=? FOR UPDATE", [
        orderId,
      ]);
      if (!rows.length) throw httpError(404, "Order not found");

      const current = String(rows[0].status || "pending").toLowerCase();
      if (current === "cancelled" && status !== "cancelled") {
        throw httpError(400, "A cancelled order can't be reopened");
      }

      if (status === "cancelled" && current !== "cancelled") {
        await restoreOrderStock(conn, orderId);
      }

      await runQuery(conn, "UPDATE orders SET status=? WHERE id=?", [status, orderId]);
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    return serverError(res, err);
  }

  const sent = await sendStatusEmail(orderId, status);
  res.json({ message: sent ? "Order status updated ✅ Email sent to user" : "Order status updated ✅" });
});

app.get("/orders/:id", verifyAdmin, (req, res) => {
  const id = req.params.id;

  // include the customer's account email for the admin order page
  const qOrder = `
    SELECT orders.*, users.email AS user_email
    FROM orders
    LEFT JOIN users ON orders.user_id = users.id
    WHERE orders.id = ?
  `;

  db.query(qOrder, [id], (err, order) => {
    if (err) return serverError(res, err);

    if (!order || order.length === 0) {
      return res.status(404).json({ message: "Not found" });
    }

    // include the product photo (if the product still exists)
    const qItems = `
      SELECT order_items.*, products.image AS product_image
      FROM order_items
      LEFT JOIN products ON products.id = order_items.product_id
      WHERE order_items.order_id = ?
    `;

    db.query(qItems, [id], (err2, items) => {
      if (err2) return serverError(res, err2);
      res.json({ order: order[0], items });
    });
  });
});

app.delete("/orders/:id", verifyAdmin, async (req, res) => {
  const orderId = req.params.id;

  // Deleting an open (pending/processing) order returns its stock.
  // Done orders were sold and cancelled ones already returned their stock.
  try {
    await withTransaction(async (conn) => {
      const rows = await runQuery(conn, "SELECT status FROM orders WHERE id=? FOR UPDATE", [
        orderId,
      ]);
      if (!rows.length) throw httpError(404, "Order not found");

      const current = String(rows[0].status || "pending").toLowerCase();
      if (current === "pending" || current === "processing") {
        await restoreOrderStock(conn, orderId);
      }

      // order_items are removed by ON DELETE CASCADE
      await runQuery(conn, "DELETE FROM orders WHERE id=?", [orderId]);
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    return serverError(res, err);
  }

  res.json({ message: "Order deleted ✅" });
});
// ✅ USER: get my orders
app.get("/my-orders", verifyUser, (req, res) => {
  const q = `
    SELECT id, customer_name, customer_phone, customer_address, total, delivery_fee,
           payment_method, status, created_at
    FROM orders
    WHERE user_id = ?
    ORDER BY id DESC
  `;

  db.query(q, [req.user.id], (err, rows) => {
    if (err) return serverError(res, err);
    res.json(rows);
  });
});

// Customer cancels their own order while it's still pending: stock goes back, email confirms
app.post("/my-orders/:id/cancel", verifyUser, limitRequests(20, 60, undefined, { perAccount: true }), async (req, res) => {
  const orderId = Number(req.params.id);
  try {
    await withTransaction(async (conn) => {
      const [order] = await runQuery(conn, "SELECT status FROM orders WHERE id=? AND user_id=? FOR UPDATE", [
        orderId,
        req.user.id,
      ]);
      if (!order) throw httpError(404, "Order not found");
      if (String(order.status || "pending").toLowerCase() !== "pending") {
        throw httpError(400, "This order is already being prepared, so it can't be cancelled online. Please call us.");
      }
      await restoreOrderStock(conn, orderId);
      await runQuery(conn, "UPDATE orders SET status='cancelled' WHERE id=?", [orderId]);
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    return serverError(res, err);
  }

  await sendStatusEmail(orderId, "cancelled");
  notifyAdminOfOrder(orderId, "cancelled");
  res.json({ message: "Your order was cancelled." });
});

// ✅ USER: get one order with items
app.get("/my-orders/:id", verifyUser, (req, res) => {
  const orderId = req.params.id;

  const qOrder = `
    SELECT id, customer_name, customer_phone, customer_address, total, delivery_fee,
           payment_method, status, created_at
    FROM orders
    WHERE id = ? AND user_id = ?
  `;

  db.query(qOrder, [orderId, req.user.id], (err, orderRows) => {
    if (err) return serverError(res, err);

    if (!orderRows.length) {
      return res.status(404).json({ message: "Order not found" });
    }

    // include the product photo (if the product still exists)
    const qItems = `
      SELECT order_items.product_name, order_items.price, order_items.quantity,
             products.image AS product_image
      FROM order_items
      LEFT JOIN products ON products.id = order_items.product_id
      WHERE order_items.order_id = ?
    `;

    db.query(qItems, [orderId], (err2, itemRows) => {
      if (err2) return serverError(res, err2);

      res.json({
        order: orderRows[0],
        items: itemRows,
      });
    });
  });
});
/*
   CHATBOT (rule-based shop assistant, see chatbot.js)
*/
app.post("/chatbot", limitRequests(20, 1, "You're sending messages too fast. Please wait a moment."), createChatbot({ db, jwt, secret: SECRET }));

/*
   CONTACT FORM
*/
app.post("/contact", limitRequests(5, 60, "Too many messages from here. Please try again later, or call us."), (req, res) => {
  const { fname, email, message } = req.body;

  if (!fname || !email || !message) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const q = "INSERT INTO contacts (full_name, email, message) VALUES (?,?,?)";

  db.query(q, [fname.trim(), email.trim(), message.trim()], (err, result) => {
    if (err) {
      console.error("Contact insert error:", err);
      return res.status(500).json({ message: "Server error" });
    }

    res.json({ message: "Message sent successfully ✅", id: result.insertId });
  });
});

app.get("/contacts", verifyAdmin, (req, res) => {
  db.query("SELECT * FROM contacts ORDER BY id DESC", (err, data) => {
    if (err) return serverError(res, err);
    res.json(data);
  });
});
app.put("/contacts/:id/status", verifyAdmin, (req, res) => {
  const { status } = req.body;
  const contactId = req.params.id;

  const allowedStatuses = ["new", "read", "done"];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  const q = "UPDATE contacts SET status=? WHERE id=?";

  db.query(q, [status, contactId], (err, result) => {
    if (err) return serverError(res, err);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Message not found" });
    }

    res.json({ message: "Message status updated ✅" });
  });
});

app.delete("/contacts/:id", verifyAdmin, (req, res) => {
  db.query("DELETE FROM contacts WHERE id=?", [req.params.id], (err) => {
    if (err) return serverError(res, err);
    res.json({ message: "Message deleted ✅" });
  });
});

/*
   ADMIN DASHBOARD STATS
*/
/*
   UNCONFIRMED SIGN-UPS: someone typed their details but never entered the email code.
   That's not a customer yet; after 48 hours the sign-up is removed (they can simply sign up
   again). Accounts with Google or with orders are never touched. Checked at start and hourly.
*/
const UNCONFIRMED_KEEP_HOURS = 48;
const removeOldUnconfirmedSignups = async () => {
  try {
    const result = await runQuery(
      db,
      `DELETE FROM users
        WHERE email_verified = 0 AND google_id IS NULL
          AND created_at < NOW() - INTERVAL ? HOUR
          AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = users.id)`,
      [UNCONFIRMED_KEEP_HOURS]
    );
    if (result.affectedRows) console.log(`🧹 Removed ${result.affectedRows} unconfirmed sign-up(s) older than ${UNCONFIRMED_KEEP_HOURS} hours`);
  } catch (err) {
    console.error("❌ Could not clean up unconfirmed sign-ups:", err.message);
  }
};
setTimeout(removeOldUnconfirmedSignups, 10 * 1000);
setInterval(removeOldUnconfirmedSignups, 60 * 60 * 1000).unref();

/*
   ADMIN CUSTOMERS
   Spent / orders count only orders that weren't cancelled.
   Phone / address: what the customer saved in their account, else their latest order.
*/
app.get("/admin/customers", verifyAdmin, async (req, res) => {
  try {
    const rows = await runQuery(
      db,
      `SELECT u.id, u.name, u.email, u.created_at, u.email_verified, (u.google_id IS NOT NULL) AS google_linked,
              COALESCE(NULLIF(u.phone, ''), (SELECT o2.customer_phone FROM orders o2 WHERE o2.user_id = u.id ORDER BY o2.id DESC LIMIT 1)) AS phone,
              COUNT(o.id) AS orders_count,
              COALESCE(SUM(o.total), 0) AS total_spent,
              MAX(o.created_at) AS last_order_at,
              COALESCE(SUM(o.status IN ('pending', 'processing')), 0) AS open_orders
       FROM users u
       LEFT JOIN orders o ON o.user_id = u.id AND o.status <> 'cancelled'
       GROUP BY u.id
       ORDER BY total_spent DESC, u.id DESC`
    );
    res.json(
      rows.map((r) => ({
        ...r,
        email_verified: !!r.email_verified,
        google_linked: !!r.google_linked,
        orders_count: Number(r.orders_count),
        total_spent: Number(r.total_spent),
        open_orders: Number(r.open_orders),
      }))
    );
  } catch (err) {
    serverError(res, err);
  }
});

// Delete a customer account, only if it has no orders (orders are the shop's records and must stay)
app.delete("/admin/customers/:id", verifyAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(404).json({ message: "Customer not found" });
  try {
    const [user] = await runQuery(db, "SELECT id FROM users WHERE id=?", [id]);
    if (!user) return res.status(404).json({ message: "Customer not found" });
    const [{ n }] = await runQuery(db, "SELECT COUNT(*) AS n FROM orders WHERE user_id=?", [id]);
    if (Number(n) > 0) {
      return res.status(400).json({ message: "This customer has orders, so the account can't be deleted (the orders must stay on record)." });
    }
    await runQuery(db, "DELETE FROM users WHERE id=?", [id]); // their wishlist goes with it
    res.json({ message: "Customer deleted" });
  } catch (err) {
    serverError(res, err);
  }
});

app.get("/admin/customers/:id", verifyAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(404).json({ message: "Customer not found" });
  try {
    const [user] = await runQuery(
      db,
      `SELECT id, name, email, phone, address, created_at, email_verified, (google_id IS NOT NULL) AS google_linked
       FROM users WHERE id = ?`,
      [id]
    );
    if (!user) return res.status(404).json({ message: "Customer not found" });

    const orders = await runQuery(
      db,
      `SELECT o.id, o.created_at, o.status, o.total, o.customer_phone, o.customer_address,
              (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS items
       FROM orders o WHERE o.user_id = ? ORDER BY o.id DESC`,
      [id]
    );
    const topProducts = await runQuery(
      db,
      `SELECT oi.product_id AS id, COALESCE(p.name, MAX(oi.product_name)) AS name, p.image,
              SUM(oi.quantity) AS qty, SUM(oi.quantity * oi.price) AS spent
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id AND o.user_id = ? AND o.status <> 'cancelled'
       LEFT JOIN products p ON p.id = oi.product_id
       GROUP BY oi.product_id, p.name, p.image
       ORDER BY qty DESC, spent DESC
       LIMIT 5`,
      [id]
    );
    const [{ n: wishlist }] = await runQuery(db, "SELECT COUNT(*) AS n FROM wishlist_items WHERE user_id = ?", [id]);

    const counted = orders.filter((o) => o.status !== "cancelled");
    const spent = counted.reduce((sum, o) => sum + Number(o.total), 0);
    const latest = orders[0];

    res.json({
      customer: {
        ...user,
        email_verified: !!user.email_verified,
        google_linked: !!user.google_linked,
        phone: user.phone || latest?.customer_phone || "",
        address: user.address || latest?.customer_address || "",
      },
      stats: {
        orders: counted.length,
        cancelled: orders.length - counted.length,
        spent,
        average: counted.length ? spent / counted.length : 0,
        first_order_at: orders.length ? orders[orders.length - 1].created_at : null,
        last_order_at: latest?.created_at || null,
        wishlist: Number(wishlist),
      },
      orders: orders.map((o) => ({ ...o, total: Number(o.total), items: Number(o.items) })),
      topProducts: topProducts.map((p) => ({ ...p, qty: Number(p.qty), spent: Number(p.spent) })),
    });
  } catch (err) {
    serverError(res, err);
  }
});

/*
   ADMIN SIDEBAR COUNTERS (checked every minute by the admin panel)
*/
app.get("/admin/counts", verifyAdmin, async (req, res) => {
  try {
    const [o] = await runQuery(db, "SELECT COUNT(*) AS n FROM orders WHERE status='pending'");
    const [m] = await runQuery(db, "SELECT COUNT(*) AS n FROM contacts WHERE status='new'");
    const [latest] = await runQuery(db, "SELECT COALESCE(MAX(id), 0) AS id FROM orders");
    res.json({ pendingOrders: Number(o.n), newMessages: Number(m.n), latestOrderId: Number(latest.id) });
  } catch (err) {
    serverError(res, err);
  }
});

/*
   QUICK STOCK CHANGE (products list)
*/
app.patch("/products/:id/stock", verifyAdmin, async (req, res) => {
  const stock = Number(req.body?.stock_quantity);
  if (!Number.isInteger(stock) || stock < 0 || stock > 100000) {
    return res.status(400).json({ message: "Stock must be a whole number, 0 or more." });
  }
  try {
    const result = await runQuery(db, "UPDATE products SET stock_quantity=? WHERE id=?", [stock, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Stock updated", stock_quantity: stock });
  } catch (err) {
    serverError(res, err);
  }
});

/*
   SHOW / HIDE A PRODUCT (hidden = only the admin sees it, nothing is deleted)
*/
app.put("/products/:id/active", verifyAdmin, async (req, res) => {
  const active = req.body?.active ? 1 : 0;
  try {
    const result = await runQuery(db, "UPDATE products SET active=? WHERE id=?", [active, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: "Product not found" });
    res.json({ message: active ? "Product is shown in the shop" : "Product hidden", active });
  } catch (err) {
    serverError(res, err);
  }
});

/*
   BULK EDIT (products list: tick products, pick a change, Apply)
   { ids: [1, 2], action, value }
     show / hide            -
     category               category id
     price_set              new price
     price_percent          +10 = 10% more, -15 = 15% less (rounded to cents)
     stock_set              new stock
*/
app.put("/products/bulk", verifyAdmin, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? [...new Set(req.body.ids.map(Number))] : [];
  const { action } = req.body || {};
  const value = Number(req.body?.value);
  if (!ids.length || ids.length > 1000 || ids.some((id) => !Number.isInteger(id) || id < 1)) {
    return res.status(400).json({ message: "Choose the products to change." });
  }

  let sql;
  let params;
  if (action === "show" || action === "hide") {
    sql = "UPDATE products SET active=? WHERE id IN (?)";
    params = [action === "show" ? 1 : 0, ids];
  } else if (action === "category") {
    if (!Number.isInteger(value) || value < 1) return res.status(400).json({ message: "Choose a category." });
    const [cat] = await runQuery(db, "SELECT id FROM categories WHERE id=?", [value]).catch(() => []);
    if (!cat) return res.status(400).json({ message: "That category doesn't exist." });
    sql = "UPDATE products SET category_id=? WHERE id IN (?)";
    params = [value, ids];
  } else if (action === "price_set") {
    if (!Number.isFinite(value) || value <= 0 || value > 1000000) return res.status(400).json({ message: "Enter a price above $0." });
    sql = "UPDATE products SET price=? WHERE id IN (?)";
    params = [Math.round(value * 100) / 100, ids];
  } else if (action === "price_percent") {
    if (!Number.isFinite(value) || value <= -90 || value > 500 || value === 0) {
      return res.status(400).json({ message: "Enter a change between -90% and +500%." });
    }
    sql = "UPDATE products SET price = GREATEST(0.01, ROUND(price * ?, 2)) WHERE id IN (?)";
    params = [1 + value / 100, ids];
  } else if (action === "sale_percent") {
    // put on sale: the normal price becomes the old price (kept if already on sale), the price goes down
    if (!Number.isFinite(value) || value < 1 || value > 90) return res.status(400).json({ message: "Enter a discount between 1% and 90%." });
    sql = `UPDATE products
              SET old_price = IF(old_price > price, old_price, price),
                  price = GREATEST(0.01, ROUND(old_price * ?, 2)),
                  sale_ends = ?
            WHERE id IN (?)`;
    params = [1 - value / 100, cleanDay(req.body?.ends), ids];
  } else if (action === "sale_end") {
    // end the sale now: back to the normal price
    sql = "UPDATE products SET price = IF(old_price > price, old_price, price), old_price = NULL, sale_ends = NULL WHERE id IN (?)";
    params = [ids];
  } else if (action === "stock_set") {
    if (!Number.isInteger(value) || value < 0 || value > 100000) return res.status(400).json({ message: "Stock must be a whole number, 0 or more." });
    sql = "UPDATE products SET stock_quantity=? WHERE id IN (?)";
    params = [value, ids];
  } else {
    return res.status(400).json({ message: "Choose what to change." });
  }

  try {
    const result = await runQuery(db, sql, params);
    res.json({ message: "Products updated", changed: result.affectedRows });
  } catch (err) {
    serverError(res, err);
  }
});

/*
   ADMIN SALES OVERVIEW (dashboard)
   Sales = orders that weren't cancelled (pending, processing and completed), delivery included.
   ?from=YYYY-MM-DD&to=YYYY-MM-DD picks the days (default: the last 30 days, today included).
   Also: the same number of days just before (to compare), sales per day / week / month for the
   chart, best sellers and top categories in those days, and products running low.
*/
const DAY_MS = 24 * 60 * 60 * 1000;
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseDay = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

app.get("/admin/sales", verifyAdmin, async (req, res) => {
  const lowStock = Math.max(0, Math.min(50, parseInt(req.query.low, 10) || 2));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let to = parseDay(req.query.to) || today;
  let from = parseDay(req.query.from) || addDays(to, -29);
  if (from > to) [from, to] = [to, from];
  if ((to - from) / DAY_MS > 3 * 366) from = addDays(to, -3 * 366);

  const days = Math.round((to - from) / DAY_MS) + 1;
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  // chart bars: one per day for up to 2 months, then per week, then per month
  const bucket = days <= 62 ? "day" : days <= 371 ? "week" : "month";
  const bucketSql =
    bucket === "day"
      ? "DATE_FORMAT(DATE(o.created_at), '%Y-%m-%d')"
      : bucket === "week"
      ? "DATE_FORMAT(DATE_SUB(DATE(o.created_at), INTERVAL WEEKDAY(o.created_at) DAY), '%Y-%m-%d')"
      : "DATE_FORMAT(o.created_at, '%Y-%m-01')";
  const inRange = "o.status <> 'cancelled' AND o.created_at >= ? AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)";
  const span = [dayKey(from), dayKey(to)];

  try {
    const [totals] = await runQuery(db, `SELECT COUNT(*) AS orders, COALESCE(SUM(o.total), 0) AS sales FROM orders o WHERE ${inRange}`, span);
    const [previous] = await runQuery(
      db,
      `SELECT COUNT(*) AS orders, COALESCE(SUM(o.total), 0) AS sales FROM orders o WHERE ${inRange}`,
      [dayKey(prevFrom), dayKey(prevTo)]
    );
    const [items] = await runQuery(
      db,
      `SELECT COALESCE(SUM(oi.quantity), 0) AS sold FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE ${inRange}`,
      span
    );

    const rows = await runQuery(
      db,
      `SELECT ${bucketSql} AS bucket, COUNT(*) AS orders, COALESCE(SUM(o.total), 0) AS sales
       FROM orders o WHERE ${inRange} GROUP BY bucket ORDER BY bucket`,
      span
    );

    const topProducts = await runQuery(
      db,
      `SELECT oi.product_id AS id, COALESCE(p.name, MAX(oi.product_name)) AS name, p.image,
              SUM(oi.quantity) AS sold, SUM(oi.quantity * oi.price) AS sales
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE ${inRange}
       GROUP BY oi.product_id, p.name, p.image
       ORDER BY sold DESC, sales DESC
       LIMIT 5`,
      span
    );

    const topCategories = await runQuery(
      db,
      `SELECT COALESCE(c.name, 'Other') AS name, SUM(oi.quantity) AS sold, SUM(oi.quantity * oi.price) AS sales
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products p ON p.id = oi.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE ${inRange}
       GROUP BY COALESCE(c.name, 'Other')
       ORDER BY sales DESC
       LIMIT 6`,
      span
    );

    const lowStockProducts = await runQuery(
      db,
      "SELECT id, name, image, stock_quantity FROM products WHERE stock_quantity <= ? ORDER BY stock_quantity, name LIMIT 10",
      [lowStock]
    );

    // Every bar of the chart, also the ones without sales
    const byBucket = new Map(rows.map((r) => [r.bucket, r]));
    const series = [];
    let cursor =
      bucket === "day"
        ? new Date(from)
        : bucket === "week"
        ? addDays(from, -((from.getDay() + 6) % 7))
        : new Date(from.getFullYear(), from.getMonth(), 1);
    while (cursor <= to) {
      const key = dayKey(cursor);
      const r = byBucket.get(key);
      series.push({ start: key, orders: Number(r?.orders || 0), sales: Number(r?.sales || 0) });
      cursor = bucket === "day" ? addDays(cursor, 1) : bucket === "week" ? addDays(cursor, 7) : new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    const sales = Number(totals.sales);
    const orders = Number(totals.orders);
    res.json({
      from: dayKey(from),
      to: dayKey(to),
      days,
      bucket,
      totals: { sales, orders, average: orders ? sales / orders : 0, itemsSold: Number(items.sold) },
      previous: { from: dayKey(prevFrom), to: dayKey(prevTo), sales: Number(previous.sales), orders: Number(previous.orders) },
      series,
      topProducts: topProducts.map((p) => ({ ...p, sold: Number(p.sold), sales: Number(p.sales) })),
      topCategories: topCategories.map((c) => ({ ...c, sold: Number(c.sold), sales: Number(c.sales) })),
      lowStock: lowStockProducts,
      lowStockLimit: lowStock,
    });
  } catch (err) {
    serverError(res, err);
  }
});

app.get("/admin/stats", verifyAdmin, (req, res) => {
  const stats = {};

  const qProducts = "SELECT COUNT(*) AS totalProducts FROM products";
  const qPlaces = "SELECT COUNT(*) AS totalPlaces FROM places";

  // ✅ UPDATED: professional order stats
  const qOrders = `
    SELECT
      COUNT(*) AS totalOrders,
      SUM(status = 'pending') AS pendingOrders,
      SUM(status = 'processing') AS processingOrders,
      SUM(status = 'done') AS completedOrders,
      SUM(status = 'cancelled') AS cancelledOrders,
      COALESCE(SUM(CASE WHEN status = 'done' THEN total ELSE 0 END), 0) AS totalRevenue
    FROM orders
  `;

  // ✅ UPDATED: professional message stats
  const qContacts = `
    SELECT
      COUNT(*) AS totalMessages,
      SUM(status = 'new') AS newMessages,
      SUM(status = 'read') AS readMessages,
      SUM(status = 'done') AS doneMessages
    FROM contacts
  `;

  db.query(qProducts, (err1, r1) => {
    if (err1) return serverError(res, err1);
    stats.totalProducts = r1[0].totalProducts;

    db.query(qPlaces, (err2, r2) => {
      if (err2) return serverError(res, err2);
      stats.totalPlaces = r2[0].totalPlaces;

      db.query(qOrders, (err3, r3) => {
        if (err3) return serverError(res, err3);

        stats.totalOrders = r3[0].totalOrders || 0;
        stats.pendingOrders = r3[0].pendingOrders || 0;
        stats.processingOrders = r3[0].processingOrders || 0;
        stats.completedOrders = r3[0].completedOrders || 0;
        stats.cancelledOrders = r3[0].cancelledOrders || 0;

        // ✅ revenue only from done orders
        stats.totalRevenue = Number(r3[0].totalRevenue || 0);

        db.query(qContacts, (err4, r4) => {
          if (err4) return serverError(res, err4);

          stats.totalMessages = r4[0].totalMessages || 0;
          stats.newMessages = r4[0].newMessages || 0;
          stats.readMessages = r4[0].readMessages || 0;
          stats.doneMessages = r4[0].doneMessages || 0;

          db.query(
            "SELECT id, customer_name, total, status, created_at FROM orders ORDER BY id DESC LIMIT 5",
            (err5, recentOrders) => {
              if (err5) return serverError(res, err5);

              // ✅ UPDATED: include message status
              db.query(
                "SELECT id, full_name, email, status, created_at FROM contacts ORDER BY id DESC LIMIT 5",
                (err6, recentMessages) => {
                  if (err6) return serverError(res, err6);

                  return res.json({
                    stats,
                    recentOrders,
                    recentMessages,
                  });
                }
              );
            }
          );
        });
      });
    });
  });
});

// Unknown address
app.use((req, res) => res.status(404).json({ message: "Not found" }));

/*
   ERROR HANDLER (upload errors etc.)
   Visitors never see error details (database messages, file paths): those only go to the server log.
*/
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? `Image must be ${MAX_UPLOAD_SIZE / (1024 * 1024)} MB or smaller`
        : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
        ? `You can add up to ${MAX_GALLERY} extra photos at a time`
        : err.message;
    return res.status(400).json({ message });
  }

  console.error(err);
  // too-big or broken requests get a plain message; anything else is just "Server error"
  const status = err.status || err.statusCode || 500;
  const message =
    status >= 500
      ? "Server error"
      : err.type === "entity.too.large"
      ? "That request is too big."
      : err.type // the request body couldn't be read (e.g. broken JSON)
      ? "That request couldn't be read."
      : err.message;
  res.status(status).json({ message });
});

/*
   START SERVER
*/
// Hosting services (Render...) choose the port and pass it in PORT; on this computer it's 5001
const PORT = Number(process.env.PORT) || 5001;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));