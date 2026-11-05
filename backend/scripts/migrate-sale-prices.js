/*
  Database update: sale prices (Admin → Products → "Old price").

  Adds to products:
    old_price   the price before the sale, shown crossed out next to the price with a "-20%" badge
                (only when it's higher than the price)
    sale_ends   optional last day of the sale; after it the old price is no longer shown

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
    for (const [name, type] of [
      ["old_price", "DECIMAL(10,2) NULL"],
      ["sale_ends", "DATE NULL"],
    ]) {
      if (existing.has(name)) {
        console.log(`• products.${name} already exists`);
      } else {
        await query(`ALTER TABLE products ADD COLUMN ${name} ${type}`);
        console.log(`✅ added products.${name}`);
      }
    }
    console.log("Done.");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exitCode = 1;
  } finally {
    db.end();
  }
})();
