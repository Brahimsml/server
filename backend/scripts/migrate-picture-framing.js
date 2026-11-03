/*
  Database update: how a picture sits in its box (the crop tool in Admin → Banners and
  Admin → Categories). The picture file itself is never changed, so it can be re-cropped.

  banners:     image_mobile (optional picture made for phones, shown there instead of a crop)
               img_zoom (100 = fills the box exactly, less = zoomed out, more = zoomed in)
               img_fill (what shows around a zoomed-out picture: dark or blur)
               (left/right and up/down are the existing focus_x / focus_y)
  categories:  pic_zoom, pic_x, pic_y, pic_fill: the same for the round category picture

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

const addColumns = async (table, columns) => {
  const existing = new Set((await query(`SHOW COLUMNS FROM ${table}`)).map((c) => c.Field));
  for (const [name, type] of columns) {
    if (existing.has(name)) {
      console.log(`• ${table}.${name} already exists`);
    } else {
      await query(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
      console.log(`✅ added ${table}.${name}`);
    }
  }
};

(async () => {
  try {
    await addColumns("banners", [
      ["image_mobile", "VARCHAR(255) NULL"],
      ["img_zoom", "SMALLINT UNSIGNED NOT NULL DEFAULT 100"],
      ["img_fill", "VARCHAR(5) NOT NULL DEFAULT 'dark'"],
    ]);
    await addColumns("categories", [
      ["pic_zoom", "SMALLINT UNSIGNED NOT NULL DEFAULT 100"],
      ["pic_x", "TINYINT UNSIGNED NOT NULL DEFAULT 50"],
      ["pic_y", "TINYINT UNSIGNED NOT NULL DEFAULT 50"],
      ["pic_fill", "VARCHAR(5) NOT NULL DEFAULT 'dark'"],
    ]);
    console.log("Done.");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exitCode = 1;
  } finally {
    db.end();
  }
})();
