/*
  Database update: "sign out other devices" when a password changes.

  Adds to users and admins:
    session_version   goes up by 1 each time the password changes; every sign-in carries the
                      number it was made with, so older sign-ins (other phones, laptops) stop working

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
    for (const table of ["users", "admins"]) {
      const existing = new Set((await query(`SHOW COLUMNS FROM ${table}`)).map((c) => c.Field));
      if (existing.has("session_version")) {
        console.log(`• ${table}.session_version already exists`);
      } else {
        await query(`ALTER TABLE ${table} ADD COLUMN session_version INT NOT NULL DEFAULT 0`);
        console.log(`✅ added ${table}.session_version`);
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
