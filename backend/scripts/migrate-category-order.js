/*
  Database update: category order (the admin sets it with up/down arrows).

  Adds to the categories table:
    sort_order   position on the site: lower comes first

  First run only: Graphics Cards, Monitors, Laptops first, then the others by
  number of products. Orders you set later in the admin are never changed.

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

const FIRST = [/graphic|gpu/i, /monitor/i, /laptop/i];

(async () => {
  try {
    const existing = new Set((await query("SHOW COLUMNS FROM categories")).map((c) => c.Field));
    if (existing.has("sort_order")) {
      console.log("• categories.sort_order already exists (order left as it is)");
      return;
    }
    await query("ALTER TABLE categories ADD COLUMN sort_order INT NOT NULL DEFAULT 0");
    console.log("✅ added categories.sort_order");

    const cats = await query(
      "SELECT c.id, c.name, COUNT(p.id) AS n FROM categories c LEFT JOIN products p ON p.category_id = c.id GROUP BY c.id"
    );
    const rank = (c) => {
      const i = FIRST.findIndex((re) => re.test(c.name));
      return i === -1 ? FIRST.length : i;
    };
    cats.sort((a, b) => rank(a) - rank(b) || b.n - a.n || a.name.localeCompare(b.name));
    for (const [i, c] of cats.entries()) {
      await query("UPDATE categories SET sort_order=? WHERE id=?", [i + 1, c.id]);
    }
    console.log("✅ order:", cats.map((c) => c.name).join(" → "));
    console.log("Done.");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exitCode = 1;
  } finally {
    db.end();
  }
})();
