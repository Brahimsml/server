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
   DB CONNECTION (LOCAL + ONLINE)
*/
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "pc_store",
  port: process.env.DB_PORT || 3306,
});

db.connect((err) => {
  if (err) {
    console.error("❌ DB connection error:", err);
    return;
  }
  console.log("✅ Connected to MySQL database");
});

/*
   JWT MIDDLEWARE (ADMIN)
*/
const verifyAdmin = (req, res, next) => {
  const auth = req.headers.authorization; // "Bearer TOKEN"
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

    if (!data || data.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

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

  const q =
    "INSERT INTO places (name,address,tel,image) VALUES (?,?,?,?)";
  db.query(q, [name, address, tel, image], (err, data) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Place added ✅" });
  });
});

app.post(
  "/places/modify/:id",
  verifyAdmin,
  upload.single("image"),
  (req, res) => {
    const { name, address, tel, existingImage } = req.body;
    const image = req.file ? req.file.filename : existingImage;

    const q =
      "UPDATE places SET name=?, address=?, tel=?, image=? WHERE id=?";
    db.query(
      q,
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

  const q =
    "INSERT INTO products (category_id,name,price,image,label,description) VALUES (?,?,?,?,?,?)";
  db.query(
    q,
    [category_id, name, price, image, label || null, description],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Product added ✅" });
    }
  );
});

app.post(
  "/products/modify/:id",
  verifyAdmin,
  upload.single("image"),
  (req, res) => {
    const {
      category_id,
      name,
      price,
      label,
      description,
      existingImage,
    } = req.body;

    const image = req.file ? req.file.filename : existingImage;

    const q = `
      UPDATE products
      SET category_id=?, name=?, price=?, image=?, label=?, description=?
      WHERE id=?
    `;
    db.query(
      q,
      [
        category_id,
        name,
        price,
        image,
        label || null,
        description,
        req.params.id,
      ],
      (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Product updated ✅" });
      }
    );
  }
);

app.delete("/products/:id", verifyAdmin, (req, res) => {
  db.query(
    "DELETE FROM products WHERE id=?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Product deleted ✅" });
    }
  );
});

/*
   ORDERS
*/
const cleanPrice = (p) => Number(String(p).replace(/[$,]/g, ""));

app.post("/orders", (req, res) => {
  const {
    customer_name,
    customer_phone,
    customer_address,
    items,
  } = req.body;

  if (!items || !items.length)
    return res.status(400).json({ message: "Cart empty" });

  const total = items.reduce(
    (sum, it) => sum + cleanPrice(it.price) * (it.qty || 1),
    0
  );

  const qOrder =
    "INSERT INTO orders (customer_name,customer_phone,customer_address,total) VALUES (?,?,?,?)";

  db.query(
    qOrder,
    [customer_name, customer_phone, customer_address, total],
    (err, result) => {
      if (err) return res.status(500).json(err);

      const orderId = result.insertId;
      const qItems =
        "INSERT INTO order_items (order_id,product_id,product_name,price,quantity) VALUES ?";

      const values = items.map((it) => [
        orderId,
        it.id,
        it.name,
        cleanPrice(it.price),
        it.qty || 1,
      ]);

      db.query(qItems, [values], (err2) => {
        if (err2) return res.status(500).json(err2);
        res.json({
          message: "Order placed ✅",
          order_id: orderId,
          total,
        });
      });
    }
  );
});

/*
   CONTACT
*/
app.post("/contact", (req, res) => {
  const { fname, email, message } = req.body;

  if (!fname || !email || !message)
    return res.status(400).json({ message: "All fields required" });

  const q =
    "INSERT INTO contacts (full_name,email,message) VALUES (?,?,?)";

  db.query(q, [fname.trim(), email.trim(), message.trim()], (err, result) => {
    if (err) return res.status(500).json({ message: "Server error" });
    res.json({ message: "Message sent ✅", id: result.insertId });
  });
});

/*
   ADMIN STATS
*/
app.get("/admin/stats", verifyAdmin, (req, res) => {
  const stats = {};

  db.query(
    "SELECT COUNT(*) AS totalProducts FROM products",
    (e1, r1) => {
      if (e1) return res.status(500).json(e1);
      stats.totalProducts = r1[0].totalProducts;

      db.query(
        "SELECT COUNT(*) AS totalPlaces FROM places",
        (e2, r2) => {
          if (e2) return res.status(500).json(e2);
          stats.totalPlaces = r2[0].totalPlaces;

          db.query(
            "SELECT COUNT(*) AS totalOrders, COALESCE(SUM(total),0) AS totalRevenue FROM orders",
            (e3, r3) => {
              if (e3) return res.status(500).json(e3);
              stats.totalOrders = r3[0].totalOrders;
              stats.totalRevenue = Number(r3[0].totalRevenue);

              db.query(
                "SELECT COUNT(*) AS totalMessages FROM contacts",
                (e4, r4) => {
                  if (e4) return res.status(500).json(e4);
                  stats.totalMessages = r4[0].totalMessages;

                  res.json({ stats });
                }
              );
            }
          );
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
