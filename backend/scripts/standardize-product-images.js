/*
  One-time update: give every existing product photo the same size and margin
  (new uploads are processed automatically).

  The original photos are copied to backend/image-backups/<date-time>/ first.
  To undo, copy them back into backend/images.

  Usage (from the backend folder):  npm run standardize-images
*/
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env"), quiet: true });
const fs = require("fs");
const path = require("path");
const mysql = require("mysql");
const { standardizeProductImage } = require("../productImages");

const imagesDir = path.join(__dirname, "..", "images");
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const backupDir = path.join(__dirname, "..", "image-backups", stamp);

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
    const rows = await query("SELECT DISTINCT image FROM products WHERE image IS NOT NULL AND image <> ''");
    const files = rows
      .map((r) => path.basename(r.image))
      .filter((f) => fs.existsSync(path.join(imagesDir, f)));

    fs.mkdirSync(backupDir, { recursive: true });
    let done = 0;

    for (const file of files) {
      const src = path.join(imagesDir, file);
      fs.copyFileSync(src, path.join(backupDir, file));
      try {
        if (await standardizeProductImage(src)) {
          done += 1;
          console.log(`✅ ${file}`);
        } else {
          console.log(`• skipped ${file} (unsupported type)`);
        }
      } catch (err) {
        console.error(`❌ ${file}: ${err.message} (left unchanged)`);
      }
    }

    console.log(`\nDone: ${done} of ${files.length} product photos updated.`);
    console.log(`Originals saved in ${backupDir}`);
  } catch (err) {
    console.error("❌ Failed:", err);
    process.exitCode = 1;
  } finally {
    db.end();
  }
})();
