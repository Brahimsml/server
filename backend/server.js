require("dotenv").config();
const express = require("express");
const cors = require("cors");
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
const { buildOrderEmail, buildPasswordResetEmail, buildVerificationEmail } = require("./emails");
const { processProductUpload } = require("./productImages");
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

// Main website address, used for links in emails
const SITE_URL = allowedOrigins[0];

app.use(
  cors({
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
  })
);
app.use(express.json());

/*
   STATIC IMAGES
*/
app.use("/images", express.static(path.join(__dirname, "images")));

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
    "SELECT (SELECT COUNT(*) FROM products WHERE image=?) + (SELECT COUNT(*) FROM places WHERE image=?) AS n",
    [file, file],
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
  if (req.file) fs.unlink(req.file.path, () => {});
};

// Current image of a product/place row (table name is fixed in code, never user input)
const getCurrentImage = (table, id, cb) =>
  db.query(`SELECT image FROM ${table} WHERE id=?`, [id], (err, rows) =>
    cb(err, rows && rows[0] ? rows[0].image : null)
  );

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (ALLOWED_IMAGE_TYPES[ext] && ALLOWED_IMAGE_TYPES[ext] === file.mimetype) {
      return cb(null, true);
    }

    const err = new Error("Only JPG, PNG, WEBP or GIF images are allowed");
    err.status = 400;
    cb(err);
  },
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

const signUserToken = (user) =>
  jwt.sign({ id: user.id, email: user.email, role: "user" }, SECRET, { expiresIn: "2h" });

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
      token: signUserToken(data[0]),
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
    res.json({ message: "Email confirmed", token: signUserToken(user), user: publicUser(user) });
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

    res.json({ message: "Login success", token: signUserToken(user), user: publicUser(user) });
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
app.get("/categories", (req, res) => {
  db.query("SELECT * FROM categories ORDER BY name", (err, data) => {
    if (err) return serverError(res, err);
    res.json(data);
  });
});

const cleanCategoryName = (name) => String(name || "").trim().replace(/\s+/g, " ");

app.post("/categories", verifyAdmin, (req, res) => {
  const name = cleanCategoryName(req.body.name);
  if (!name) return res.status(400).json({ message: "Enter a category name" });
  if (name.length > 100) return res.status(400).json({ message: "The name is too long (100 characters max)" });

  db.query("INSERT INTO categories (name) VALUES (?)", [name], (err, result) => {
    if (err && err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: `A category called "${name}" already exists` });
    }
    if (err) return serverError(res, err);
    res.json({ id: result.insertId, name });
  });
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
   PRODUCTS CRUD
*/
app.get("/products", (req, res) => {
  const q = `
    SELECT p.*, c.name AS category_name
    FROM products p
    JOIN categories c ON p.category_id = c.id
    ORDER BY p.id DESC
  `;

  db.query(q, (err, data) => {
    if (err) return serverError(res, err);
    res.json(data);
  });
});

app.get("/products/search/:id", (req, res) => {
  db.query("SELECT * FROM products WHERE id=?", [req.params.id], (err, data) => {
    if (err) return serverError(res, err);
    res.json(data);
  });
});

// processProductUpload: every product photo gets the same size and margin
app.post("/products", verifyAdmin, upload.single("image"), processProductUpload, (req, res) => {
  // ✅ ADDED stock_quantity
  const { category_id, name, price, label, description, stock_quantity } = req.body;
  const image = req.file ? req.file.filename : null;

  // ✅ ADDED stock_quantity column
  const q =
    "INSERT INTO products (category_id,name,price,image,label,description,stock_quantity) VALUES (?,?,?,?,?,?,?)";

  db.query(
    q,
    [
      category_id,
      name,
      price,
      image,
      label || null,
      description,
      Number(stock_quantity) || 0, // ✅ ADDED
    ],
    (err) => {
      if (err) {
        discardUpload(req);
        return serverError(res, err);
      }
      res.json({ message: "Product added ✅" });
    }
  );
});

app.delete("/products/:id", verifyAdmin, (req, res) => {
  getCurrentImage("products", req.params.id, (imgErr, oldImage) => {
    if (imgErr) return serverError(res, imgErr);

    db.query("DELETE FROM products WHERE id=?", [req.params.id], (err) => {
      if (err) return serverError(res, err);
      removeImageIfUnused(oldImage);
      res.json({ message: "Product deleted ✅" });
    });
  });
});

app.post("/products/modify/:id", verifyAdmin, upload.single("image"), processProductUpload, (req, res) => {
  // ✅ ADDED stock_quantity
  const { category_id, name, price, label, description, existingImage, stock_quantity } = req.body;
  const image = req.file ? req.file.filename : existingImage;

  // ✅ ADDED stock_quantity in update
  const q = `
    UPDATE products
    SET category_id=?, name=?, price=?, image=?, label=?, description=?, stock_quantity=?
    WHERE id=?
  `;

  getCurrentImage("products", req.params.id, (imgErr, oldImage) => {
    if (imgErr) {
      discardUpload(req);
      return serverError(res, imgErr);
    }

    db.query(
      q,
      [
        category_id,
        name,
        price,
        image,
        label || null,
        description,
        Number(stock_quantity) || 0, // ✅ ADDED
        req.params.id,
      ],
      (err) => {
        if (err) {
          discardUpload(req);
          return serverError(res, err);
        }
        if (oldImage !== image) removeImageIfUnused(oldImage);
        res.json({ message: "Product updated ✅" });
      }
    );
  });
});

/*
   ORDERS / CHECKOUT
*/

/*
   USER CHECKOUT - LOGIN REQUIRED
*/
app.post("/orders", verifyUser, async (req, res) => {
  const { customer_name, customer_phone, customer_address, items } = req.body;

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

    total = orderItems.reduce((sum, it) => sum + it.price * it.qty, 0);

    const result = await runQuery(
      conn,
      "INSERT INTO orders (user_id, customer_name, customer_phone, customer_address, total) VALUES (?,?,?,?,?)",
      [req.user.id, customer_name, customer_phone, customer_address, total]
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

  // Confirmation email (with product photos)
  try {
    const email = buildOrderEmail({
      kind: "confirmation",
      order: { id: orderId, customer_name, customer_phone, customer_address, total, created_at: new Date() },
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

  {
    // Status email to the customer (same design as the confirmation, with the items)
    const qOrder = `
      SELECT orders.id, orders.customer_name, orders.customer_phone, orders.customer_address,
             orders.total, orders.status, orders.created_at, users.email
      FROM orders
      JOIN users ON orders.user_id = users.id
      WHERE orders.id = ?
    `;
    const qItems = `
      SELECT order_items.product_name AS name, order_items.price, order_items.quantity AS qty,
             products.image
      FROM order_items
      LEFT JOIN products ON products.id = order_items.product_id
      WHERE order_items.order_id = ?
    `;

    db.query(qOrder, [orderId], async (err2, rows) => {
      if (err2) return serverError(res, err2);

      if (!rows.length) {
        return res.json({
          message: "Order status updated ✅ but user email not found",
        });
      }

      const order = rows[0];

      try {
        const items = await new Promise((resolve, reject) =>
          db.query(qItems, [orderId], (e, r) => (e ? reject(e) : resolve(r)))
        );
        const email = buildOrderEmail({
          kind: status,
          order,
          items,
          siteUrl: SITE_URL,
          imagesDir,
        });
        await transporter.sendMail({
          from: `"MegaTech" <${process.env.EMAIL_USER}>`,
          to: order.email,
          ...email,
        });

        console.log(`✅ Status email sent to ${order.email}`);
      } catch (emailErr) {
        console.error("❌ Status email failed:", emailErr);
      }

      res.json({
        message: "Order status updated ✅ Email sent to user",
      });
    });
  }
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
    SELECT id, customer_name, customer_phone, customer_address, total, status, created_at
    FROM orders
    WHERE user_id = ?
    ORDER BY id DESC
  `;

  db.query(q, [req.user.id], (err, rows) => {
    if (err) return serverError(res, err);
    res.json(rows);
  });
});

// ✅ USER: get one order with items
app.get("/my-orders/:id", verifyUser, (req, res) => {
  const orderId = req.params.id;

  const qOrder = `
    SELECT id, customer_name, customer_phone, customer_address, total, status, created_at
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
        : err.message;
    return res.status(400).json({ message });
  }

  console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : "Server error" });
});

/*
   START SERVER
*/
app.listen(5001, () =>
  console.log("✅ Server running on http://localhost:5001")
);