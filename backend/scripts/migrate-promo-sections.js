/*
  Database update: promo sections on the home page (Admin → Banners → Promo sections).

  Creates the promo_sections table:
    layout       wide (1 banner), halves (2 side by side) or thirds (3 tiles)
    position     where on the home page: after_trust, after_categories, after_best,
                 after_new, cat:<category name> (after that category's row) or bottom
    active       shown on the site or hidden
    starts_on    show from this day (optional)
    ends_on      show until this day (optional)
    sort_order   order of sections that share a position

  and adds to banners (each slot of a section is a banner row with placement 'promo'):
    section_id   the promo section it belongs to
    slot         its place in the section (0, 1, 2 from left to right)

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
    await query(`
      CREATE TABLE IF NOT EXISTS promo_sections (
        id INT AUTO_INCREMENT PRIMARY KEY,
        layout VARCHAR(10) NOT NULL DEFAULT 'halves',
        position VARCHAR(80) NOT NULL DEFAULT 'after_new',
        active TINYINT(1) NOT NULL DEFAULT 1,
        starts_on DATE NULL,
        ends_on DATE NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ promo_sections table ready");

    const existing = new Set((await query("SHOW COLUMNS FROM banners")).map((c) => c.Field));
    for (const [name, type] of [
      ["section_id", "INT NULL"],
      ["slot", "TINYINT UNSIGNED NULL"],
    ]) {
      if (existing.has(name)) {
        console.log(`• banners.${name} already exists`);
      } else {
        await query(`ALTER TABLE banners ADD COLUMN ${name} ${type}`);
        console.log(`✅ added banners.${name}`);
      }
    }
    const indexes = new Set((await query("SHOW INDEX FROM banners")).map((i) => i.Key_name));
    if (!indexes.has("idx_banners_section")) {
      await query("CREATE INDEX idx_banners_section ON banners (section_id)");
      console.log("✅ added index on banners.section_id");
    }
    console.log("Done.");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exitCode = 1;
  } finally {
    db.end();
  }
})();
