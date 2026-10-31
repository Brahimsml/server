/*
  Database update: opening hours for each store (Admin → Places).

  Adds places.hours: JSON text like {"mon":{"open":"10:00","close":"20:00"},...,"sun":null}.
  Empty (NULL) = no hours shown for that store.

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
    const existing = new Set((await query("SHOW COLUMNS FROM places")).map((c) => c.Field));
    if (existing.has("hours")) {
      console.log("• places.hours already exists");
    } else {
      await query("ALTER TABLE places ADD COLUMN hours TEXT NULL");
      console.log("✅ added places.hours");
    }
    console.log("Done.");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exitCode = 1;
  } finally {
    db.end();
  }
})();
