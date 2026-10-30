require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const mysql = require("mysql");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const nodemailer = require("nodemailer");
const createChatbot = require("./chatbot");
const { buildOrderEmail, buildPasswordResetEmail, buildVerificationEmail, buildAdminOrderEmail } = require("./emails");
const { processProductUpload, processProductUploads, processBannerUpload } = require("./productImages");
const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
  console.error("❌ JWT_SECRET is missing. Add it to backend/.env");
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
app.use(express.json());

/*
   STATIC IMAGES
*/
// Browsers may keep images for a day instead of downloading them on every visit
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
          + (SELECT COUNT(*) FROM product_images WHERE image=?) + (SELECT COUNT(*) FROM banners WHERE image=?)
          + (SELECT COUNT(*) FROM categories WHERE image=?) AS n`,
    [file, file, file, file, file],
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

    req.admin = decoded;
    next();
  });
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

    req.user = decoded;
    next();
  });
};

/*
   LOGIN ATTEMPT LIMIT (stops password guessing)
   Max 10 failed logins per 15 minutes per IP + route; a successful login resets it.
*/
const LOGIN_MAX_FAILS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginFails = new Map();

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
app.post("/admin/login", limitLoginAttempts, (req, res) => {
  const { email, password } = req.body;

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

    const token = jwt.sign(
      { id: data[0].id, email: data[0].email, role: "admin" },
      SECRET,
      { expiresIn: "1h" }
    );

    return res.json({
      message: "Login success",
      token,
      admin: { id: data[0].id, email: data[0].email },
    });
  });
});

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
  jwt.sign({ id: user.id, email: user.email, role: "user" }, SECRET, {
    expiresIn: remember ? "30d" : "2h",
  });

const wantsRemember = (req) => req.body?.remember === true || req.body?.remember === "true";

const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email });

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
app.post("/users/register", async (req, res) => {
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
    await runQuery(db, "UPDATE users SET password=? WHERE id=?", [await bcrypt.hash(next, 10), user.id]);
    res.json({ message: "Your password was changed." });
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

app.post("/users/reset-password", (req, res) => {
  const { id, token, password } = req.body || {};
  const invalid = () =>
    res.status(400).json({ message: "This reset link is invalid or has expired. Please request a new one." });

  if (!id || !token) return invalid();
  if (!password || String(password).length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  db.query("SELECT id, password FROM users WHERE id=?", [id], async (err, rows) => {
    if (err) return serverError(res, err);
    if (!rows.length) return invalid();

    let payload;
    try {
      payload = jwt.verify(String(token), resetSecretFor(rows[0]));
    } catch {
      return invalid(); // expired, tampered with, or already used (password changed)
    }
    if (payload.purpose !== "password-reset" || Number(payload.id) !== Number(rows[0].id)) return invalid();

    try {
      const hashed = await bcrypt.hash(String(password), 10);
      db.query("UPDATE users SET password=? WHERE id=?", [hashed, rows[0].id], (err2) => {
        if (err2) return serverError(res, err2);
        res.json({ message: "Your password was changed. You can sign in now." });
      });
    } catch (e) {
      serverError(res, e);
    }
  });
});

/*
   ADMIN ACCOUNT: change password + keep the session alive
*/
const signAdminToken = (admin) =>
  jwt.sign({ id: admin.id, email: admin.email, role: "admin" }, SECRET, { expiresIn: "1h" });

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
      db.query("UPDATE admins SET password=? WHERE id=?", [hashed, req.admin.id], (err2) => {
        if (err2) return serverError(res, err2);
        res.json({ message: "Password changed" });
      });
    } catch (e) {
      serverError(res, e);
    }
  });
});

// Issue a fresh 1-hour token while the admin is active (the admin page calls this)
app.post("/admin/refresh", verifyAdmin, (req, res) => {
  db.query("SELECT id, email FROM admins WHERE id=?", [req.admin.id], (err, rows) => {
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

    await runQuery(db, "UPDATE categories SET image=? WHERE id=?", [image, req.params.id]);
    if (category.image && category.image !== image) removeImageIfUnused(category.image);
    res.json({ message: "Category picture saved", image });
  } catch (err) {
    discardUpload(req);
    serverError(res, err);
  }
});

// Back to the automatic picture
app.delete("/categories/:id/image", verifyAdmin, async (req, res) => {
  try {
    const [category] = await runQuery(db, "SELECT image FROM categories WHERE id=?", [req.params.id]);
    if (!category) return res.status(404).json({ message: "Category not found" });
    await runQuery(db, "UPDATE categories SET image=NULL WHERE id=?", [req.params.id]);
    if (category.image) removeImageIfUnused(category.image);
    res.json({ message: "The picture is automatic again" });
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

  const q = "INSERT INTO places (name,address,tel,image,lat,lng) VALUES (?,?,?,?,?,?)";

  db.query(q, [name, address, tel, image, lat || null, lng || null], (err, data) => {
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

  const q = "UPDATE places SET name=?, address=?, tel=?, image=?, lat=?, lng=? WHERE id=?";

  getCurrentImage("places", req.params.id, (imgErr, oldImage) => {
    if (imgErr) {
      discardUpload(req);
      return serverError(res, imgErr);
    }

    db.query(
      q,
      [name, address, tel, image, lat || null, lng || null, req.params.id],
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

const BANNER_COLUMNS = "eyebrow, title, subtitle, button_text, link, active, text_align, text_color, shade, focus_x, focus_y, starts_on, ends_on";
const bannerValues = (f) => [
  f.eyebrow, f.title, f.subtitle, f.button_text, f.link, f.active,
  f.text_align, f.text_color, f.shade, f.focus_x, f.focus_y, f.starts_on, f.ends_on,
];

// Shown on the home page, in the admin's order (only on their scheduled days, if any)
app.get("/banners", (req, res) => {
  db.query(
    `SELECT id, image, eyebrow, title, subtitle, button_text, link, text_align, text_color, shade, focus_x, focus_y
     FROM banners
     WHERE active=1 AND (starts_on IS NULL OR starts_on <= CURDATE()) AND (ends_on IS NULL OR ends_on >= CURDATE())
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
    FROM banners ORDER BY sort_order, id`;
  db.query(sql, (err, rows) => {
    if (err) return serverError(res, err);
    res.json(rows);
  });
});

app.post("/banners", verifyAdmin, upload.single("image"), processBannerUpload, async (req, res) => {
  const fields = bannerFields(req.body);
  const problem = !req.file ? "Choose a banner image." : bannerError(fields);
  if (problem) {
    discardUpload(req);
    return res.status(400).json({ message: problem });
  }
  try {
    const result = await runQuery(
      db,
      `INSERT INTO banners (image, ${BANNER_COLUMNS}, sort_order)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(MAX(sort_order), 0) + 1 FROM banners`,
      [req.file.filename, ...bannerValues(fields)]
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

app.put("/banners/:id", verifyAdmin, upload.single("image"), processBannerUpload, async (req, res) => {
  const fields = bannerFields(req.body);
  const problem = bannerError(fields);
  if (problem) {
    discardUpload(req);
    return res.status(400).json({ message: problem });
  }
  try {
    const [current] = await runQuery(db, "SELECT image FROM banners WHERE id=?", [req.params.id]);
    if (!current) {
      discardUpload(req);
      return res.status(404).json({ message: "Banner not found" });
    }
    const image = req.file ? req.file.filename : current.image;
    await runQuery(
      db,
      `UPDATE banners SET image=?, ${BANNER_COLUMNS.split(", ").map((c) => `${c}=?`).join(", ")} WHERE id=?`,
      [image, ...bannerValues(fields), req.params.id]
    );
    if (req.file && current.image !== image) removeImageIfUnused(current.image);
    res.json({ message: "Banner updated" });
  } catch (err) {
    discardUpload(req);
    serverError(res, err);
  }
});

app.delete("/banners/:id", verifyAdmin, async (req, res) => {
  try {
    const [banner] = await runQuery(db, "SELECT image FROM banners WHERE id=?", [req.params.id]);
    if (!banner) return res.status(404).json({ message: "Banner not found" });
    await runQuery(db, "DELETE FROM banners WHERE id=?", [req.params.id]);
    removeImageIfUnused(banner.image);
    res.json({ message: "Banner deleted" });
  } catch (err) {
    serverError(res, err);
  }
});

/*
   PRODUCTS CRUD
*/
app.get("/products", (req, res) => {
  const q = `
    SELECT p.*, c.name AS category_name, c.sort_order AS category_order, c.image AS category_image
    FROM products p
    JOIN categories c ON p.category_id = c.id
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
    SELECT p.*, c.name AS category_name
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `;
  db.query(q, [id], (err, rows) => {
    if (err) return serverError(res, err);
    if (!rows.length) return res.status(404).json({ message: "Product not found" });

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

    const result = await runQuery(
      db,
      "INSERT INTO products (category_id,name,brand,price,image,label,description,stock_quantity,specs) VALUES (?,?,?,?,?,?,?,?,?)",
      [category_id, name, cleanBrand(brand), price, image, label || null, description, Number(stock_quantity) || 0, cleanSpecs(specs)]
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
    await withTransaction(async (conn) => {
      await runQuery(
        conn,
        `UPDATE products
         SET category_id=?, name=?, brand=?, price=?, image=?, label=?, description=?, stock_quantity=?, specs=?
         WHERE id=?`,
        [category_id, name, cleanBrand(brand), price, image, label || null, description, Number(stock_quantity) || 0, cleanSpecs(specs), productId]
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

app.post("/orders", verifyUser, async (req, res) => {
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
      "SELECT id, name, price, stock_quantity, image FROM products WHERE id IN (?) FOR UPDATE",
      [productIds]
    );

    orderItems = [];

    for (const [id, qty] of requestedQty) {
      const product = productsStock.find((p) => Number(p.id) === id);

      if (!product) {
        await runQuery(conn, "ROLLBACK");
        return res.status(400).json({ message: `Product #${id} not found` });
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
app.post("/my-orders/:id/cancel", verifyUser, async (req, res) => {
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
app.post("/chatbot", createChatbot({ db, jwt, secret: SECRET }));

/*
   CONTACT FORM
*/
app.post("/contact", (req, res) => {
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
   ADMIN SALES OVERVIEW
   Sales = orders that weren't cancelled (pending, processing and completed), delivery included.
*/
const SALES_WEEKS = 8;

app.get("/admin/sales", verifyAdmin, async (req, res) => {
  const lowStock = Math.max(0, Math.min(50, parseInt(req.query.low, 10) || 2));
  try {
    // Week = Monday to Sunday
    const weekly = await runQuery(
      db,
      `SELECT DATE_FORMAT(DATE_SUB(DATE(created_at), INTERVAL WEEKDAY(created_at) DAY), '%Y-%m-%d') AS week,
              COUNT(*) AS orders, COALESCE(SUM(total), 0) AS sales
       FROM orders
       WHERE status <> 'cancelled'
         AND created_at >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL ? WEEK)
       GROUP BY week
       ORDER BY week`,
      [SALES_WEEKS - 1]
    );

    const [months] = await runQuery(
      db,
      `SELECT
         COALESCE(SUM(CASE WHEN created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN total END), 0) AS thisMonthSales,
         COUNT(CASE WHEN created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN 1 END) AS thisMonthOrders,
         COALESCE(SUM(CASE WHEN created_at >= DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH, '%Y-%m-01')
                            AND created_at < DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN total END), 0) AS lastMonthSales,
         COUNT(CASE WHEN created_at >= DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH, '%Y-%m-01')
                     AND created_at < DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN 1 END) AS lastMonthOrders
       FROM orders
       WHERE status <> 'cancelled'`
    );

    const topProducts = await runQuery(
      db,
      `SELECT oi.product_id AS id, COALESCE(p.name, MAX(oi.product_name)) AS name, p.image,
              SUM(oi.quantity) AS sold, SUM(oi.quantity * oi.price) AS sales
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE o.status <> 'cancelled' AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY oi.product_id, p.name, p.image
       ORDER BY sold DESC, sales DESC
       LIMIT 5`
    );

    const lowStockProducts = await runQuery(
      db,
      "SELECT id, name, image, stock_quantity FROM products WHERE stock_quantity <= ? ORDER BY stock_quantity, name LIMIT 10",
      [lowStock]
    );

    // Fill in weeks without sales so the chart always shows every week
    const byWeek = new Map(weekly.map((w) => [w.week, w]));
    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const weeks = [];
    for (let i = SALES_WEEKS - 1; i >= 0; i--) {
      const d = new Date(monday);
      d.setDate(d.getDate() - i * 7);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const w = byWeek.get(key);
      weeks.push({ week: key, orders: Number(w?.orders || 0), sales: Number(w?.sales || 0) });
    }

    res.json({
      weeks,
      thisMonth: { sales: Number(months.thisMonthSales), orders: Number(months.thisMonthOrders) },
      lastMonth: { sales: Number(months.lastMonthSales), orders: Number(months.lastMonthOrders) },
      topProducts: topProducts.map((p) => ({ ...p, sold: Number(p.sold), sales: Number(p.sales) })),
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

/*
   ERROR HANDLER (upload errors etc.)
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
  res.status(err.status || 500).json({ message: err.status ? err.message : "Server error" });
});

/*
   START SERVER
*/
// Hosting services (Render...) choose the port and pass it in PORT; on this computer it's 5001
const PORT = Number(process.env.PORT) || 5001;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));