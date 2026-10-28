/*
  Database update: home page banners (Admin → Banners).

  Creates the banners table:
    image        1600 x 600 picture (in /images)
    image_mobile optional 1200 x 900 picture for phones
    eyebrow      small gold line above the headline (optional)
    title        the headline
    subtitle     one short line under it (optional)
    button_text  e.g. "Shop now"
    link         where the button goes: /shop?category=..., /product/12, or a full https link
    active       shown on the site or hidden
    sort_order   lower comes first

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

    // added later: an optional phone picture (1200 x 900)
    const columns = new Set((await query("SHOW COLUMNS FROM banners")).map((c) => c.Field));
    if (columns.has("image_mobile")) console.log("• banners.image_mobile already exists");
    else {
      await query("ALTER TABLE banners ADD COLUMN image_mobile VARCHAR(255) NULL AFTER image");
      console.log("✅ added banners.image_mobile");
    }
    console.log("Done.");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exitCode = 1;
  } finally {
    db.end();
  }
})();
