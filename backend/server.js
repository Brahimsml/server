const express = require("express");
const cors = require("cors");
const mysql = require("mysql");
const path = require("path");
const multer = require("multer");
const jwt = require("jsonwebtoken");

const SECRET = "pc_store_secret_key";

const app = express();
app.use(cors());
app.use(express.json());

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
    cb(null, file.originalname + "_" + Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

/* 
   DB CONNECTION
 */
const db = mysql.createConnection({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT
});
db.connect(err => {
  if (err) {
    console.error("MySQL connection failed:", err);
    return; // Stop queries if connection fails
  }
  console.log("MySQL connected successfully");
});

/*
   JWT MIDDLEWARE (ADMIN)
*/
const verifyAdmin = (req, res, next) => {
  const auth = req.headers.authorization; // "Bearer TOKEN"
  if (!auth) return res.status(403).json({ message: "No token provided" });

  const token = auth.split(" ")[1];
  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Token invalid/expired" });
    req.admin = decoded;
    next();
  });
};

/*
   Test route
*/
app.get("/", (req, res) => {
  res.send("PC Store backend working ✅");
});

/* 
   admin login (JWT)
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

    return res.json({
      message: "Login success",
      token,
      admin: { id: data[0].id, email: data[0].email },
    });
  });
});

/*
   categories
*/
app.get("/categories", (req, res) => {
  db.query("SELECT * FROM categories", (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

/* 
   PLACES CRUD
*/

// PUBLIC
app.get("/places", (req, res) => {
  db.query("SELECT * FROM places", (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});


app.get("/places/search/:id", (req, res) => {
  db.query("SELECT * FROM places WHERE id=?", [req.params.id], (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

// ADMIN
app.post("/places", verifyAdmin, upload.single("image"), (req, res) => {
  const { name, address, tel } = req.body;
  const image = req.file ? req.file.filename : null;

  const q = "INSERT INTO places (name,address,tel,image) VALUES (?,?,?,?)";
  db.query(q, [name, address, tel, image], (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

app.delete("/places/:id", verifyAdmin, (req, res) => {
  db.query("DELETE FROM places WHERE id=?", [req.params.id], (err, data) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Place deleted ✅" });
  });
});

app.post("/places/modify/:id", verifyAdmin, upload.single("image"), (req, res) => {
  const { name, address, tel, existingImage } = req.body;
  const image = req.file ? req.file.filename : existingImage;

  const q = "UPDATE places SET name=?, address=?, tel=?, image=? WHERE id=?";
  db.query(q, [name, address, tel, image, req.params.id], (err, data) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Place updated ✅" });
  });
});

/*
   PRODUCTS CRUD
 */

// PUBLIC
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
  db.query("SELECT * FROM products WHERE id=?", [req.params.id], (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

// ADMIN
app.post("/products", verifyAdmin, upload.single("image"), (req, res) => {
  const { category_id, name, price, label, description } = req.body;
  const image = req.file ? req.file.filename : null;

  const q =
    "INSERT INTO products (category_id,name,price,image,label,description) VALUES (?,?,?,?,?,?)";
  db.query(
    q,
    [category_id, name, price, image, label || null, description],
    (err, data) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Product added ✅" });
    }
  );
});

app.delete("/products/:id", verifyAdmin, (req, res) => {
  db.query("DELETE FROM products WHERE id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Product deleted ✅" });
  });
});

app.post("/products/modify/:id", verifyAdmin, upload.single("image"), (req, res) => {
  const { category_id, name, price, label, description, existingImage } = req.body;
  const image = req.file ? req.file.filename : existingImage;

  const q = `
    UPDATE products
    SET category_id=?, name=?, price=?, image=?, label=?, description=?
    WHERE id=?
  `;
  db.query(
    q,
    [category_id, name, price, image, label || null, description, req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Product updated ✅" });
    }
  );
});

/*
   ORDERS / CHECKOUT
 */
const cleanPrice = (p) => Number(String(p).replace(/[$,]/g, ""));

// PUBLIC checkout
app.post("/orders", (req, res) => {
  const { customer_name, customer_phone, customer_address, items } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({ message: "Cart empty" });
  }

  const total = items.reduce(
    (sum, it) => sum + cleanPrice(it.price) * (it.qty || 1),
    0
  );

  const qOrder =
    "INSERT INTO orders (customer_name,customer_phone,customer_address,total) VALUES (?,?,?,?)";

  db.query(qOrder, [customer_name, customer_phone, customer_address, total], (err, result) => {
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
      res.json({ message: "Order placed ✅", order_id: orderId, total });
    });
  });
});

// ADMIN orders
app.get("/orders", verifyAdmin, (req, res) => {
  db.query("SELECT * FROM orders ORDER BY id DESC", (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

app.get("/orders/:id", verifyAdmin, (req, res) => {
  const id = req.params.id;

  db.query("SELECT * FROM orders WHERE id=?", [id], (err, order) => {
    if (err) return res.status(500).json(err);
    if (!order || order.length === 0) return res.status(404).json({ message: "Not found" });

    db.query("SELECT * FROM order_items WHERE order_id=?", [id], (err2, items) => {
      if (err2) return res.status(500).json(err2);
      res.json({ order: order[0], items });
    });
  });
});

app.delete("/orders/:id", verifyAdmin, (req, res) => {
  db.query("DELETE FROM orders WHERE id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Order deleted ✅" });
  });
});
/* 
   CONTACT FORM
 */

// PUBLIC submit contact
app.post("/contact", (req, res) => {
  const { fname, email, message } = req.body; // frontend sends fname

  if (!fname || !email || !message) {
    return res.status(400).json({ message: "All fields are required" });
  }


  const q = "INSERT INTO contacts (full_name, email, message) VALUES (?,?,?)";

  db.query(q, [fname.trim(), email.trim(), message.trim()], (err, result) => {
    if (err) {
      console.error("Contact insert error:", err);
      return res.status(500).json({ message: "Server error" });
    }

    res.json({ message: "Message sent successfully ✅", id: result.insertId });
  });
});

// ADMIN view contacts
app.get("/contacts", verifyAdmin, (req, res) => {
  db.query("SELECT * FROM contacts ORDER BY id DESC", (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

//  ADMIN delete a contact
app.delete("/contacts/:id", verifyAdmin, (req, res) => {
  db.query("DELETE FROM contacts WHERE id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Message deleted ✅" });
  });
});
/*
   ADMIN DASHBOARD STATS (JWT)
 */
app.get("/admin/stats", verifyAdmin, (req, res) => {
  const stats = {};

  const qProducts = "SELECT COUNT(*) AS totalProducts FROM products";
  const qPlaces = "SELECT COUNT(*) AS totalPlaces FROM places";
  const qOrders = "SELECT COUNT(*) AS totalOrders, COALESCE(SUM(total),0) AS totalRevenue FROM orders";
  const qContacts = "SELECT COUNT(*) AS totalMessages FROM contacts";

  db.query(qProducts, (err1, r1) => {
    if (err1) return res.status(500).json(err1);
    stats.totalProducts = r1[0].totalProducts;

    db.query(qPlaces, (err2, r2) => {
      if (err2) return res.status(500).json(err2);
      stats.totalPlaces = r2[0].totalPlaces;

      db.query(qOrders, (err3, r3) => {
        if (err3) return res.status(500).json(err3);
        stats.totalOrders = r3[0].totalOrders;
        stats.totalRevenue = Number(r3[0].totalRevenue || 0);

        db.query(qContacts, (err4, r4) => {
          if (err4) return res.status(500).json(err4);
          stats.totalMessages = r4[0].totalMessages;

          //  Recent orders (last 5)
          db.query(
            "SELECT id, customer_name, total, status, created_at FROM orders ORDER BY id DESC LIMIT 5",
            (err5, recentOrders) => {
              if (err5) return res.status(500).json(err5);

              //  Recent messages (last 5)
              db.query(
                "SELECT id, full_name, email, created_at FROM contacts ORDER BY id DESC LIMIT 5",
                (err6, recentMessages) => {
                  if (err6) return res.status(500).json(err6);

                  return res.json({
                    stats,
                    recentOrders,
                    recentMessages,
                  });
                }
              );
            }
          );
        });
      });
    });
  });
});


/*
   START SERVER
 */
app.listen(5000, () => console.log("✅ Server running on http://localhost:5000"));
