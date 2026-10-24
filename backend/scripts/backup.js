/*
  Back up the shop: the whole database + all uploaded photos.

  Creates backend/backups/<date-time>/ with:
    database.sql   every table and every row (products, customers, orders, ...)
    images/        all product and store photos
    HOW-TO-RESTORE.txt

  Copy that folder to Google Drive, a USB stick, etc. Nothing here is uploaded to GitHub.

  Usage (from the backend folder):  npm run backup
*/
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env"), quiet: true });
const fs = require("fs");
const path = require("path");
const mysql = require("mysql");

const root = path.join(__dirname, "..");
// Folder name in local time, e.g. 2026-10-24_10-05
const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
const outDir = path.join(root, "backups", stamp);

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT),
  dateStrings: true, // keep dates exactly as stored
});

const query = (sql, params) =>
  new Promise((resolve, reject) => db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))));

const ROWS_PER_INSERT = 200;

async function dumpDatabase(file) {
  const out = fs.createWriteStream(file);
  const write = (text) => new Promise((resolve) => (out.write(text) ? resolve() : out.once("drain", resolve)));

  await write(`-- MegaTech database backup\n-- Database: ${process.env.DB_NAME}\n-- Made: ${new Date().toString()}\n\n`);
  await write("SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n\n");

  const tables = (await query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")).map((r) => Object.values(r)[0]);
  const counts = {};

  for (const table of tables) {
    const [create] = await query(`SHOW CREATE TABLE \`${table}\``);
    await write(`-- ----- ${table} -----\nDROP TABLE IF EXISTS \`${table}\`;\n${create["Create Table"]};\n\n`);

    const rows = await query(`SELECT * FROM \`${table}\``);
    counts[table] = rows.length;
    if (!rows.length) continue;

    const columns = Object.keys(rows[0]).map((c) => `\`${c}\``).join(", ");
    for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
      const values = rows
        .slice(i, i + ROWS_PER_INSERT)
        .map((row) => `(${Object.values(row).map((v) => mysql.escape(v)).join(", ")})`)
        .join(",\n");
      await write(`INSERT INTO \`${table}\` (${columns}) VALUES\n${values};\n`);
    }
    await write("\n");
  }

  await write("SET FOREIGN_KEY_CHECKS = 1;\n");
  await new Promise((resolve) => out.end(resolve));
  return counts;
}

function copyImages(target) {
  const source = path.join(root, "images");
  fs.mkdirSync(target, { recursive: true });
  let count = 0;
  for (const name of fs.readdirSync(source)) {
    const from = path.join(source, name);
    if (fs.statSync(from).isFile() && !name.startsWith(".")) {
      fs.copyFileSync(from, path.join(target, name));
      count += 1;
    }
  }
  return count;
}

const HOW_TO = `HOW TO RESTORE THIS BACKUP
==========================

This replaces EVERYTHING in the shop database with what is in this backup.

Option A (from the backend folder):
    npm run restore -- backups/<this folder name> --yes

Option B (phpMyAdmin):
    1. Open phpMyAdmin and select the shop database.
    2. Import -> choose database.sql -> Go.

Then copy everything inside images/ back into backend/images/.
`;

(async () => {
  try {
    fs.mkdirSync(outDir, { recursive: true });
    const counts = await dumpDatabase(path.join(outDir, "database.sql"));
    const images = copyImages(path.join(outDir, "images"));
    fs.writeFileSync(path.join(outDir, "HOW-TO-RESTORE.txt"), HOW_TO);

    const summary = Object.entries(counts)
      .map(([t, n]) => `${t}: ${n}`)
      .join(", ");
    console.log(`✅ Backup saved in ${outDir}`);
    console.log(`   Database rows -> ${summary}`);
    console.log(`   Photos -> ${images}`);
    console.log("   Copy this folder somewhere safe (Google Drive, USB stick...).");
  } catch (err) {
    console.error("❌ Backup failed:", err);
    process.exitCode = 1;
  } finally {
    db.end();
  }
})();
