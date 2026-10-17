/*
   One-time migration: hash plain-text admin passwords with bcrypt.

   Usage (from the backend folder):
     node scripts/hash-admin-passwords.js --dry-run   # show what would change
     node scripts/hash-admin-passwords.js             # update the database

   Already-hashed passwords ($2a$ / $2b$ / $2y$) are skipped, so it is safe to run twice.
*/
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mysql = require("mysql");
const bcrypt = require("bcrypt");

const dryRun = process.argv.includes("--dry-run");

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT),
});

const query = (sql, params) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const isBcryptHash = (value) => /^\$2[aby]\$\d{2}\$/.test(value || "");

(async () => {
  try {
    const admins = await query("SELECT id, email, password FROM admins");
    const plain = admins.filter((a) => !isBcryptHash(a.password));

    console.log(`Found ${admins.length} admin(s), ${plain.length} with a plain-text password.`);

    for (const admin of plain) {
      if (dryRun) {
        console.log(`[dry run] would hash password for ${admin.email}`);
        continue;
      }

      const hashed = await bcrypt.hash(admin.password, 10);
      await query("UPDATE admins SET password=? WHERE id=?", [hashed, admin.id]);
      console.log(`✅ Hashed password for ${admin.email}`);
    }

    console.log(dryRun ? "Dry run finished, nothing changed." : "Done.");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exitCode = 1;
  } finally {
    db.end();
  }
})();
