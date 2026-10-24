/*
  Database update: saved delivery details on customer accounts.

  Adds to the users table:
    phone    customer's phone number (fills in checkout)
    address  customer's delivery address (fills in checkout)

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
  ["phone", "VARCHAR(30) NULL"],
  ["address", "VARCHAR(255) NULL"],
];

(async () => {
  try {
    const existing = new Set((await query("SHOW COLUMNS FROM users")).map((c) => c.Field));
    for (const [name, type] of COLUMNS) {
      if (existing.has(name)) {
        console.log(`• users.${name} already exists`);
        continue;
      }
      await query(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
      console.log(`✅ added users.${name}`);
    }
    console.log("Done.");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exitCode = 1;
  } finally {
    db.end();
  }
})();
