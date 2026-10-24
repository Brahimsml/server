/*
  Database update: payment method + delivery fee on orders.

  Adds to the orders table:
    payment_method  "cash" (cash on delivery) or "card" (Visa card)
    delivery_fee    what the customer paid for delivery

  Orders placed before this had no delivery fee, so they keep 0.
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
  ["payment_method", "VARCHAR(20) NOT NULL DEFAULT 'cash'"],
  ["delivery_fee", "DECIMAL(10,2) NOT NULL DEFAULT 0.00"],
];

(async () => {
  try {
    const existing = new Set((await query("SHOW COLUMNS FROM orders")).map((c) => c.Field));
    for (const [name, type] of COLUMNS) {
      if (existing.has(name)) {
        console.log(`• ${name} already exists`);
        continue;
      }
      await query(`ALTER TABLE orders ADD COLUMN ${name} ${type}`);
      console.log(`✅ added ${name}`);
    }
    console.log("Done.");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exitCode = 1;
  } finally {
    db.end();
  }
})();
