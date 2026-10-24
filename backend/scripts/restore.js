/*
  Restore a backup made with "npm run backup".
  REPLACES everything in the database with the backup, then copies the photos back.

  Usage (from the backend folder):
    npm run restore -- backups/2026-10-24_10-30 --yes

  Without --yes it only explains what it would do.
  To restore into a different database (for checking a backup): add  --database=other_name
*/
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env"), quiet: true });
const fs = require("fs");
const path = require("path");
const mysql = require("mysql");

const args = process.argv.slice(2);
const folderArg = args.find((a) => !a.startsWith("--"));
const confirmed = args.includes("--yes");
const database = (args.find((a) => a.startsWith("--database=")) || "").split("=")[1] || process.env.DB_NAME;
const skipImages = args.includes("--no-images");

const root = path.join(__dirname, "..");

(async () => {
  if (!folderArg) {
    console.log("Usage: npm run restore -- backups/<folder> --yes");
    process.exitCode = 1;
    return;
  }

  const folder = path.resolve(root, folderArg);
  const sqlFile = path.join(folder, "database.sql");
  if (!fs.existsSync(sqlFile)) {
    console.error(`❌ No database.sql in ${folder}`);
    process.exitCode = 1;
    return;
  }

  if (!confirmed) {
    console.log(`This will REPLACE everything in the "${database}" database with ${sqlFile}`);
    if (!skipImages) console.log(`and copy the backup's photos into backend/images.`);
    console.log("Run it again with --yes to continue.");
    return;
  }

  const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
    multipleStatements: true, // the backup file is a list of SQL statements
  });
  const query = (sql) => new Promise((resolve, reject) => db.query(sql, (err, rows) => (err ? reject(err) : resolve(rows))));

  try {
    await query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
    await query(`USE \`${database}\``);
    await query(fs.readFileSync(sqlFile, "utf8"));
    console.log(`✅ Database "${database}" restored from ${sqlFile}`);

    if (!skipImages) {
      const from = path.join(folder, "images");
      const to = path.join(root, "images");
      let count = 0;
      if (fs.existsSync(from)) {
        fs.mkdirSync(to, { recursive: true });
        for (const name of fs.readdirSync(from)) {
          fs.copyFileSync(path.join(from, name), path.join(to, name));
          count += 1;
        }
      }
      console.log(`✅ ${count} photos copied back into backend/images`);
    }
  } catch (err) {
    console.error("❌ Restore failed:", err.message);
    process.exitCode = 1;
  } finally {
    db.end();
  }
})();
