import "./App.css";
import NavBar from "./Components/NavBar";
import Footer from "./Components/Footer";
import ScrollToTop from "./Components/ScrollToTop";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";

import Home from "./pages/Home";
import Menu from "./pages/Menu";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Cart from "./pages/Cart";
import Shop from "./pages/Shop";
import Product from "./pages/Product";
import Policy from "./pages/Policy";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

//  Admin auth
import AdminLogin from "./pages/AdminLogin";
import AdminRoute from "./Components/AdminRoute";

//  Admin Products
import AdminProducts from "./pages/AdminProducts";
import AddProduct from "./pages/AddProduct";
import UpdateProduct from "./pages/UpdateProduct";

//  Admin Places
import AdminPlaces from "./pages/AdminPlaces";
import AddPlace from "./pages/AddPlace";
import UpdatePlace from "./pages/UpdatePlace";

// Admin Orders
import AdminOrders from "./pages/AdminOrders";
import OrderDetails from "./pages/OrderDetails";

// Admin Contacts + Dashboard
import AdminContacts from "./pages/AdminContacts";
import AdminDashboard from "./pages/AdminDashboard";

// Admin Categories + Settings
import AdminCategories from "./pages/AdminCategories";
import AdminSettings from "./pages/AdminSettings";

import { CartProvider } from "./Context/CartContext";
import ChatBot from "./Components/ChatBot";
import MyOrders from "./pages/MyOrders";
import MyOrderDetails from "./pages/MyOrderDetails"

// Admin pages have their own layout (sidebar), so the shop navbar/footer/chat are hidden there
const isAdminPath = (path) =>
  path.startsWith("/admin") || /^\/(products|categories|places|orders|contacts)(\/|$)/.test(path);

const SiteChrome = ({ children }) => {
  const { pathname } = useLocation();
  const admin = isAdminPath(pathname);

  return (
    <div className="app-container">
      {!admin && <NavBar />}
      <div className="main-content">
        <div className="page-content">{children}</div>
        {!admin && <Footer />}
      </div>
      {!admin && <ChatBot />}
    </div>
  );
};

const App = () => (
  <CartProvider>
    <Router>
      <ScrollToTop />
      <SiteChrome>
        <Routes>
          {/* PUBLIC */}
          <Route index element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:id" element={<Product />} />
          <Route path="/shipping" element={<Policy slug="shipping" />} />
          <Route path="/returns" element={<Policy slug="returns" />} />
          <Route path="/privacy" element={<Policy slug="privacy" />} />
          <Route path="/terms" element={<Policy slug="terms" />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/my-orders" element={<MyOrders />} />
<Route path="/my-orders/:id" element={<MyOrderDetails />} />

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

          {/* ADMIN CATEGORIES + SETTINGS */}
          <Route
            path="/categories/admin"
            element={
              <AdminRoute>
                <AdminCategories />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <AdminRoute>
                <AdminSettings />
              </AdminRoute>
            }
          />

          {/* Anything else */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </SiteChrome>
    </Router>
  </CartProvider>
);

export default App;
