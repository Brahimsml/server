/*
  Database update: email verification + "Continue with Google".

  Adds to the users table:
    email_verified       1 when the customer proved they own the email
    verify_code_hash     hashed 6-digit code (never stored as plain text)
    verify_code_expires  when that code stops working
    verify_attempts      wrong guesses for the current code
    google_id            Google account id for "Continue with Google"

  Customers who already exist are marked as verified so nobody is locked out.
  Safe to run more than once: it only adds what's missing.

  Usage (from the backend folder):  npm run migrate
*/
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env"), quiet: true });
const mysql = require("mysql");

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT),
});

const query = (sql, params) =>
  new Promise((resolve, reject) => db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))));

const COLUMNS = [
  ["email_verified", "TINYINT(1) NOT NULL DEFAULT 0"],
  ["verify_code_hash", "VARCHAR(255) NULL"],
  ["verify_code_expires", "DATETIME NULL"],
  ["verify_attempts", "INT NOT NULL DEFAULT 0"],
  ["google_id", "VARCHAR(64) NULL"],
];

(async () => {
  try {
    const existing = new Set((await query("SHOW COLUMNS FROM users")).map((c) => c.Field));
    const addedVerified = !existing.has("email_verified");

    for (const [name, type] of COLUMNS) {
      if (existing.has(name)) {
        console.log(`• ${name} already exists`);
        continue;
      }
      await query(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
      console.log(`✅ added ${name}`);
    }

    const indexes = (await query("SHOW INDEX FROM users")).map((i) => i.Key_name);
    if (!indexes.includes("uniq_google_id")) {
      await query("ALTER TABLE users ADD UNIQUE KEY uniq_google_id (google_id)");
      console.log("✅ added unique index on google_id");
    }

    // Only when the column is new: everyone who signed up before this counts as verified
    if (addedVerified) {
      const r = await query("UPDATE users SET email_verified = 1");
      console.log(`✅ marked ${r.affectedRows} existing customer(s) as verified`);
    }

    console.log("Done.");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exitCode = 1;
  } finally {
    db.end();
  }
})();
