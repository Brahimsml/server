/*
  Database update: wishlists saved in customer accounts.

  Adds:
    wishlist_items  which products each customer saved (one row per customer + product)
  Removing a customer or a product removes its wishlist rows too.

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

db.query(
  `CREATE TABLE IF NOT EXISTS wishlist_items (
     user_id INT NOT NULL,
     product_id INT NOT NULL,
     created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
     PRIMARY KEY (user_id, product_id),
     KEY idx_wishlist_product (product_id),
     CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
     CONSTRAINT fk_wishlist_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  (err) => {
    if (err) {
      console.error("❌ Migration failed:", err);
      process.exitCode = 1;
    } else {
      console.log("✅ wishlist_items table ready");
      console.log("Done.");
    }
    db.end();
  }
);
