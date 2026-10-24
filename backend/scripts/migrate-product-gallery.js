/*
  Database update: extra product photos + specifications.

  Adds:
    product_images  table: more photos for a product (the main photo stays in products.image)
    products.specs  text: one spec per line, e.g. "Memory: 24 GB GDDR6X"

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

(async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS product_images (
        id INT NOT NULL AUTO_INCREMENT,
        product_id INT NOT NULL,
        image VARCHAR(255) NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_product_images_product (product_id),
        CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    console.log("✅ product_images table ready");

    const columns = new Set((await query("SHOW COLUMNS FROM products")).map((c) => c.Field));
    if (columns.has("specs")) {
      console.log("• products.specs already exists");
    } else {
      await query("ALTER TABLE products ADD COLUMN specs TEXT NULL");
      console.log("✅ added products.specs");
    }
    console.log("Done.");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exitCode = 1;
  } finally {
    db.end();
  }
})();
