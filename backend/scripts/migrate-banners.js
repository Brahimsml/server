/*
  Database update: home page banners (Admin → Banners).

  Creates the banners table:
    image        the banner picture, kept whole (in /images)
    eyebrow      small gold line above the headline (optional)
    title        the headline
    subtitle     one short line under it (optional)
    button_text  e.g. "Shop now"
    link         where the button goes: /shop?category=..., /product/12, or a full https link
    active       shown on the site or hidden
    sort_order   lower comes first

  and adds the design settings (older banners keep today's look):
    text_align   where the text sits: left, center or right
    text_color   light (white text) or dark (black text, for bright pictures)
    shade        how strong the fade behind the text is: none, light, medium, strong
    focus_x/y    the spot of the picture that must stay visible (0-100 %)
    starts_on    show from this day (optional)
    ends_on      show until this day (optional)

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
      CREATE TABLE IF NOT EXISTS banners (
        id INT AUTO_INCREMENT PRIMARY KEY,
        image VARCHAR(255) NOT NULL,
        eyebrow VARCHAR(60) NULL,
        title VARCHAR(120) NOT NULL,
        subtitle VARCHAR(220) NULL,
        button_text VARCHAR(40) NOT NULL DEFAULT 'Shop now',
        link VARCHAR(255) NOT NULL DEFAULT '/shop',
        active TINYINT(1) NOT NULL DEFAULT 1,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ banners table ready");

    const existing = new Set((await query("SHOW COLUMNS FROM banners")).map((c) => c.Field));
    const columns = [
      ["text_align", "VARCHAR(10) NOT NULL DEFAULT 'left'"],
      ["text_color", "VARCHAR(10) NOT NULL DEFAULT 'light'"],
      ["shade", "VARCHAR(10) NOT NULL DEFAULT 'medium'"],
      ["focus_x", "TINYINT UNSIGNED NOT NULL DEFAULT 50"],
      ["focus_y", "TINYINT UNSIGNED NOT NULL DEFAULT 50"],
      ["starts_on", "DATE NULL"],
      ["ends_on", "DATE NULL"],
    ];
    for (const [name, type] of columns) {
      if (existing.has(name)) {
        console.log(`• banners.${name} already exists`);
      } else {
        await query(`ALTER TABLE banners ADD COLUMN ${name} ${type}`);
        console.log(`✅ added banners.${name}`);
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
