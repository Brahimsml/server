require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mysql = require("mysql");
const path = require("path");
const multer = require("multer");
const jwt = require("jsonwebtoken");

/*
   APP CONFIG
*/
const app = express();
app.use(cors());
app.use(express.json());

/*
   JWT SECRET
*/
const SECRET = process.env.JWT_SECRET || "pc_store_secret_key";

/*
   STATIC IMAGES
*/
app.use("/images", express.static(path.join(__dirname, "images")));

/*
   MULTER CONFIG
*/
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "images/"),
  filename: (req, file, cb) =>
    cb(
      null,
      file.originalname +
        "_" +
        Date.now() +
        path.extname(file.originalname)
    ),
});
const upload = multer({ storage });

/*
   ✅ DB CONNECTION (POOL + SSL — FIXED)
*/
const db = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "pc_store",
  port: process.env.DB_PORT || 3306,
  ssl:
    process.env.DB_HOST !== "localhost"
      ? { rejectUnauthorized: true }
      : false,
});

/*
   JWT MIDDLEWARE (ADMIN)
*/
const verifyAdmin = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(403).json({ message: "No token provided" });

  const token = auth.split(" ")[1];
  jwt.verify(token, SECRET, (err, decoded) => {
    if (err)
      return res.status(401).json({ message: "Token invalid or expired" });
    req.admin = decoded;
    next();
  });
};

/*
   TEST ROUTE
*/
app.get("/", (req, res) => {
  res.send("PC Store backend working ✅");
});

/*
   ADMIN LOGIN
*/
app.post("/admin/login", (req, res) => {
  const { email, password } = req.body;

  const q = "SELECT * FROM admins WHERE email=? AND password=?";
  db.query(q, [email, password], (err, data) => {
    if (err) return res.status(500).json(err);
    if (!data || data.length === 0)
      return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: data[0].id, email: data[0].email },
      SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      message: "Login success",
      token,
      admin: { id: data[0].id, email: data[0].email },
    });
  });
});

/*
   CATEGORIES
*/
app.get("/categories", (req, res) => {
  db.query("SELECT * FROM categories", (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

/*
   PLACES
*/
app.get("/places", (req, res) => {
  db.query("SELECT * FROM places", (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

app.get("/places/search/:id", (req, res) => {
  db.query(
    "SELECT * FROM places WHERE id=?",
    [req.params.id],
    (err, data) => {
      if (err) return res.status(500).json(err);
      res.json(data);
    }
  );
});

app.post("/places", verifyAdmin, upload.single("image"), (req, res) => {
  const { name, address, tel } = req.body;
  const image = req.file ? req.file.filename : null;

  db.query(
    "INSERT INTO places (name,address,tel,image) VALUES (?,?,?,?)",
    [name, address, tel, image],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Place added ✅" });
    }
  );
});

app.post(
  "/places/modify/:id",
  verifyAdmin,
  upload.single("image"),
  (req, res) => {
    const { name, address, tel, existingImage } = req.body;
    const image = req.file ? req.file.filename : existingImage;

    db.query(
      "UPDATE places SET name=?, address=?, tel=?, image=? WHERE id=?",
      [name, address, tel, image, req.params.id],
      (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Place updated ✅" });
      }
    );
  }
);

app.delete("/places/:id", verifyAdmin, (req, res) => {
  db.query(
    "DELETE FROM places WHERE id=?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Place deleted ✅" });
    }
  );
});

/*
   PRODUCTS
*/
app.get("/products", (req, res) => {
  const q = `
    SELECT p.*, c.name AS category_name
    FROM products p
    JOIN categories c ON p.category_id = c.id
    ORDER BY p.id DESC
  `;
  db.query(q, (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

app.get("/products/search/:id", (req, res) => {
  db.query(
    "SELECT * FROM products WHERE id=?",
    [req.params.id],
    (err, data) => {
      if (err) return res.status(500).json(err);
      res.json(data);
    }
  );
});

app.post("/products", verifyAdmin, upload.single("image"), (req, res) => {
  const { category_id, name, price, label, description } = req.body;
  const image = req.file ? req.file.filename : null;

  db.query(
    "INSERT INTO products (category_id,name,price,image,label,description) VALUES (?,?,?,?,?,?)",
    [category_id, name, price, image, label || null, description],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Product added ✅" });
    }
  );
});

/*
   ORDERS
*/
const cleanPrice = (p) => Number(String(p).replace(/[$,]/g, ""));

app.post("/orders", (req, res) => {
  const { customer_name, customer_phone, customer_address, items } = req.body;

  if (!items || !items.length)
    return res.status(400).json({ message: "Cart empty" });

  const total = items.reduce(
    (sum, it) => sum + cleanPrice(it.price) * (it.qty || 1),
    0
  );

  db.query(
    "INSERT INTO orders (customer_name,customer_phone,customer_address,total) VALUES (?,?,?,?)",
    [customer_name, customer_phone, customer_address, total],
    (err, result) => {
      if (err) return res.status(500).json(err);

      const orderId = result.insertId;
      const values = items.map((it) => [
        orderId,
        it.id,
        it.name,
        cleanPrice(it.price),
        it.qty || 1,
      ]);

      db.query(
        "INSERT INTO order_items (order_id,product_id,product_name,price,quantity) VALUES ?",
        [values],
        (err2) => {
          if (err2) return res.status(500).json(err2);
          res.json({ message: "Order placed ✅", order_id: orderId, total });
        }
      );
    }
  );
});

/*
   START SERVER
*/
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);
