import "./App.css";
import NavBar from "./Components/NavBar";
import Footer from "./Components/Footer";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Menu from "./pages/Menu";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Cart from "./pages/Cart";
import Login from "./pages/Login";

// ✅ Admin auth
import AdminLogin from "./pages/AdminLogin";
import AdminRoute from "./Components/AdminRoute";

// ✅ Admin Products
import AdminProducts from "./pages/AdminProducts";
import AddProduct from "./pages/AddProduct";
import UpdateProduct from "./pages/UpdateProduct";

// ✅ Admin Places
import AdminPlaces from "./pages/AdminPlaces";
import AddPlace from "./pages/AddPlace";
import UpdatePlace from "./pages/UpdatePlace";

// ✅ Admin Orders
import AdminOrders from "./pages/AdminOrders";
import OrderDetails from "./pages/OrderDetails";

// ✅ Admin Contacts + Dashboard
import AdminContacts from "./pages/AdminContacts";
import AdminDashboard from "./pages/AdminDashboard";

import { CartProvider } from "./Context/CartContext";

const App = () => (
  <CartProvider>
    <Router>
      <div className="app-container">
        <NavBar />

        <div className="main-content">
          {/* ✅ THIS is the FIX: page-content pushes footer down */}
          <div className="page-content">
            <Routes>
              {/* PUBLIC */}
              <Route index element={<Home />} />
              <Route path="/home" element={<Home />} />
              <Route path="/menu" element={<Menu />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/login" element={<Login />} />
              <Route path="/cart" element={<Cart />} />

              {/* ADMIN LOGIN */}
              <Route path="/admin/login" element={<AdminLogin />} />

              {/* ADMIN DASHBOARD */}
              <Route
                path="/admin/dashboard"
                element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                }
              />

              {/* ADMIN PRODUCTS */}
              <Route
                path="/products/admin"
                element={
                  <AdminRoute>
                    <AdminProducts />
                  </AdminRoute>
                }
              />
              <Route
                path="/products/add"
                element={
                  <AdminRoute>
                    <AddProduct />
                  </AdminRoute>
                }
              />
              <Route
                path="/products/update/:id"
                element={
                  <AdminRoute>
                    <UpdateProduct />
                  </AdminRoute>
                }
              />

              {/* ADMIN PLACES */}
              <Route
                path="/places/admin"
                element={
                  <AdminRoute>
                    <AdminPlaces />
                  </AdminRoute>
                }
              />
              <Route
                path="/places/add"
                element={
                  <AdminRoute>
                    <AddPlace />
                  </AdminRoute>
                }
              />
              <Route
                path="/places/update/:id"
                element={
                  <AdminRoute>
                    <UpdatePlace />
                  </AdminRoute>
                }
              />

              {/* ADMIN ORDERS */}
              <Route
                path="/orders/admin"
                element={
                  <AdminRoute>
                    <AdminOrders />
                  </AdminRoute>
                }
              />
              <Route
                path="/orders/:id"
                element={
                  <AdminRoute>
                    <OrderDetails />
                  </AdminRoute>
                }
              />

              {/* ADMIN CONTACTS */}
              <Route
                path="/contacts/admin"
                element={
                  <AdminRoute>
                    <AdminContacts />
                  </AdminRoute>
                }
              />
            </Routes>
          </div>

          {/* ✅ Footer always at bottom */}
          <Footer />
        </div>
      </div>
    </Router>
  </CartProvider>
);

export default App;
