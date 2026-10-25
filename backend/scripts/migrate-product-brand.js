/*
  Database update: product brands (for the shop's brand filter).

  Adds to the products table:
    brand    e.g. NVIDIA, ASUS, Logitech (set it in the admin product form)

  Products without a brand get one when the brand is written in their name
  (e.g. "NVIDIA RTX 4090" -> NVIDIA). Brands you set yourself are never changed.

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

// Well-known brands, spelled the way they should show in the shop
const BRANDS = [
  "NVIDIA", "AMD", "Intel", "ASUS", "ROG", "MSI", "Gigabyte", "ASRock", "Zotac", "Sapphire",
  "Corsair", "Logitech", "Razer", "HyperX", "SteelSeries", "Redragon", "Cooler Master", "NZXT",
  "Samsung", "LG", "Dell", "Alienware", "HP", "Lenovo", "Acer", "Apple", "BenQ", "AOC",
  "Kingston", "Seagate", "Western Digital", "Sony", "Microsoft", "Xiaomi",
];

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const brandInName = (name) =>
  BRANDS.find((b) => new RegExp(`(^|[^a-z0-9])${escape(b)}([^a-z0-9]|$)`, "i").test(name || "")) || null;

(async () => {
  try {
    const existing = new Set((await query("SHOW COLUMNS FROM products")).map((c) => c.Field));
    if (existing.has("brand")) {
      console.log("• products.brand already exists");
    } else {
      await query("ALTER TABLE products ADD COLUMN brand VARCHAR(60) NULL AFTER name");
      console.log("✅ added products.brand");
    }

    const blank = await query("SELECT id, name FROM products WHERE brand IS NULL OR brand = ''");
    let filled = 0;
    for (const p of blank) {
      const brand = brandInName(p.name);
      if (!brand) continue;
      await query("UPDATE products SET brand=? WHERE id=?", [brand === "ROG" ? "ASUS" : brand, p.id]);
      filled += 1;
    }
    console.log(`✅ brand filled in from the name for ${filled} of ${blank.length} products without one`);
    console.log("Done.");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exitCode = 1;
  } finally {
    db.end();
  }
})();
