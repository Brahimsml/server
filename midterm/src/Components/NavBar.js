import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import HomeIcon from "@mui/icons-material/Home";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import InfoIcon from "@mui/icons-material/Info";
import PhoneIcon from "@mui/icons-material/Phone";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";

// Admin icons
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import PlaceIcon from "@mui/icons-material/Place";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import LogoutIcon from "@mui/icons-material/Logout";

// Dashboard icon
import DashboardIcon from "@mui/icons-material/Dashboard";

import logo from "../Assets/logo.jpg";
import "../Styles/NavBar.css";

const NavBar = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  //  check if admin logged in
  const isAdmin = !!localStorage.getItem("adminToken");

  const logoutAdmin = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("admin");
    navigate("/admin/login");
  };

  return (
    <div
      className={`sidebar ${open ? "open" : ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Logo */}
      <div className="sidebar-logo">
        <img src={logo} alt="logo" />
        {open && <h2>MegaTech</h2>}
      </div>

      {/* Navigation */}
      <nav className="sidebar-links">
        <p className="section-title">MAIN</p>

        <Link to="/" className={location.pathname === "/" ? "active" : ""}>
          <HomeIcon />
          {open && <span>Home</span>}
        </Link>

        <Link
          to="/menu"
          className={location.pathname === "/menu" ? "active" : ""}
        >
          <LocationOnIcon />
          {open && <span>Locations</span>}
        </Link>

        <p className="section-title">INFO</p>

        <Link
          to="/about"
          className={location.pathname === "/about" ? "active" : ""}
        >
          <InfoIcon />
          {open && <span>About</span>}
        </Link>

        <Link
          to="/contact"
          className={location.pathname === "/contact" ? "active" : ""}
        >
          <PhoneIcon />
          {open && <span>Contact</span>}
        </Link>

        <Link
          to="/cart"
          className={location.pathname === "/cart" ? "active" : ""}
        >
          <ShoppingCartIcon />
          {open && <span>Cart</span>}
        </Link>

        {/*  ADMIN LINKS (only show when logged in) */}
        {isAdmin && (
          <>
            <p className="section-title">ADMIN</p>

            {/*  Dashboard */}
            <Link
              to="/admin/dashboard"
              className={
                location.pathname === "/admin/dashboard" ? "active" : ""
              }
            >
              <DashboardIcon />
              {open && <span>Dashboard</span>}
            </Link>

            <Link
              to="/products/admin"
              className={location.pathname === "/products/admin" ? "active" : ""}
            >
              <Inventory2Icon />
              {open && <span>Products</span>}
            </Link>

            <Link
              to="/places/admin"
              className={location.pathname === "/places/admin" ? "active" : ""}
            >
              <PlaceIcon />
              {open && <span>Places</span>}
            </Link>

            <Link
              to="/orders/admin"
              className={location.pathname === "/orders/admin" ? "active" : ""}
            >
              <ReceiptLongIcon />
              {open && <span>Orders</span>}
            </Link>

            <Link
              to="/contacts/admin"
              className={location.pathname === "/contacts/admin" ? "active" : ""}
            >
              <MailOutlineIcon />
              {open && <span>Contacts</span>}
            </Link>

            <button
              onClick={logoutAdmin}
              className="logout-btn"
              style={{
                background: "transparent",
                border: "none",
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "12px 15px",
                cursor: "pointer",
                color: "#fff",
              }}
            >
              <LogoutIcon />
              {open && <span>Logout</span>}
            </button>
          </>
        )}

        {/*  If not admin, show Admin Login link */}
        {!isAdmin && (
          <>
            <p className="section-title">ADMIN</p>

            <Link
              to="/admin/login"
              className={location.pathname === "/admin/login" ? "active" : ""}
            >
              <AdminPanelSettingsIcon />
              {open && <span>Admin Login</span>}
            </Link>
          </>
        )}
      </nav>
    </div>
  );
};

export default NavBar;
