/*
  Database update: a chosen picture for each category (Admin → Categories → photo).

  Adds to the categories table:
    image   the category's picture; empty = picked automatically from its products

  Safe to run more than once.

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

(async () => {
  try {
    const existing = new Set((await query("SHOW COLUMNS FROM categories")).map((c) => c.Field));
    if (existing.has("image")) {
      console.log("• categories.image already exists");
    } else {
      await query("ALTER TABLE categories ADD COLUMN image VARCHAR(255) NULL");
      console.log("✅ added categories.image");
    }
    console.log("Done.");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exitCode = 1;
  } finally {
    db.end();
  }
})();
