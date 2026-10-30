/*
  Database update: hide a product without deleting it (Admin → Products).

  Adds products.active: 1 = shown in the shop, 0 = hidden (only the admin sees it).
  Every existing product stays shown.

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
    const existing = new Set((await query("SHOW COLUMNS FROM products")).map((c) => c.Field));
    if (existing.has("active")) {
      console.log("• products.active already exists");
    } else {
      await query("ALTER TABLE products ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1");
      console.log("✅ added products.active");
    }
    console.log("Done.");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exitCode = 1;
  } finally {
    db.end();
  }
})();
