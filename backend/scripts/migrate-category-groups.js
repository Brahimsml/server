/*
  Database update: category groups (Admin → Categories), like big stores' menus:
  a few main groups ("Gaming Gear") with their categories (Keyboards, Mice…) inside.

  Adds categories.parent_id: the group a category belongs to (NULL = a main entry on its own).
  One level only: a group holds categories; a category inside a group can't hold others.
  With no groups set, the site looks exactly as before.

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
    if (existing.has("parent_id")) {
      console.log("• categories.parent_id already exists");
    } else {
      await query("ALTER TABLE categories ADD COLUMN parent_id INT NULL, ADD INDEX idx_categories_parent (parent_id)");
      console.log("✅ added categories.parent_id");
    }
    console.log("Done.");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exitCode = 1;
  } finally {
    db.end();
  }
})();
