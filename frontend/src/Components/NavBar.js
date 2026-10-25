import React, { useContext, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { CartContext } from "../Context/CartContext";
import MiniCart from "./MiniCart";
import NavSearch from "./NavSearch";
import { useWishlist } from "../Context/WishlistContext";

import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";

import logo from "../Assets/logo.jpg";
import "../Styles/theme.css";
import "../Styles/Shell.css";
import { clearUserSession, getUser } from "../utils/auth";

const MAIN_LINKS = [
  { to: "/home", label: "Home" },
  { to: "/shop", label: "Shop" },
  { to: "/menu", label: "Locations" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

const ADMIN_LINKS = [
  { to: "/admin/dashboard", label: "Dashboard", icon: DashboardOutlinedIcon },
  { to: "/products/admin", label: "Products", icon: Inventory2OutlinedIcon },
  { to: "/places/admin", label: "Places", icon: PlaceOutlinedIcon },
  { to: "/orders/admin", label: "Orders", icon: ReceiptLongOutlinedIcon },
  { to: "/contacts/admin", label: "Messages", icon: MailOutlineIcon },
];

const NavBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { cartCount, miniCart, openMiniCart, closeMiniCart } = useContext(CartContext);

  // "account" | "admin" | null — which dropdown is open
  const [openMenu, setOpenMenu] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [badgeBump, setBadgeBump] = useState(false);

  const accountRef = useRef(null);
  const adminRef = useRef(null);
  const cartRef = useRef(null);
  const prevCount = useRef(cartCount);

  const { items: wishlist } = useWishlist();
  const isAdmin = !!localStorage.getItem("adminToken");
  const user = getUser();
  const firstName = (user?.name || "Account").trim().split(/\s+/)[0];
  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();

  // Close everything when the page changes
  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
    closeMiniCart();
  }, [location.pathname, closeMiniCart]);

  // Close dropdowns on outside click / Escape
  useEffect(() => {
    const onDown = (e) => {
      if (openMenu === "account" && !accountRef.current?.contains(e.target)) setOpenMenu(null);
      if (openMenu === "admin" && !adminRef.current?.contains(e.target)) setOpenMenu(null);
      if (miniCart.open && !cartRef.current?.contains(e.target)) closeMiniCart();
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpenMenu(null);
        setMobileOpen(false);
        closeMiniCart();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu, miniCart.open, closeMiniCart]);

  // Lock page scroll behind the phone menu; let CSS hide the chat button under overlays
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    document.body.classList.toggle("nb-menu-open", mobileOpen);
    document.body.classList.toggle("nb-cart-open", miniCart.open);
    return () => {
      document.body.style.overflow = "";
      document.body.classList.remove("nb-menu-open", "nb-cart-open");
    };
  }, [mobileOpen, miniCart.open]);

  // Little bounce on the cart badge when the count goes up
  useEffect(() => {
    if (cartCount > prevCount.current) {
      setBadgeBump(true);
      const t = setTimeout(() => setBadgeBump(false), 450);
      prevCount.current = cartCount;
      return () => clearTimeout(t);
    }
    prevCount.current = cartCount;
  }, [cartCount]);

  const toggleMenu = (name) => setOpenMenu((cur) => (cur === name ? null : name));

  const toggleCart = () => {
    setOpenMenu(null);
    setMobileOpen(false);
    if (miniCart.open) closeMiniCart();
    else openMiniCart();
  };

  // Full reload so everything tied to the account (like the wishlist) is cleared
  const logoutUser = () => {
    clearUserSession();
    setOpenMenu(null);
    setMobileOpen(false);
    window.location.href = "/home";
  };

  const logoutAdmin = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("admin");
    setOpenMenu(null);
    setMobileOpen(false);
    navigate("/admin/login");
  };

  const isHome = location.pathname === "/" || location.pathname === "/home";
  const linkClass = ({ isActive }, to) =>
    `nb-link ${isActive || (to === "/home" && isHome) ? "is-active" : ""}`;

  return (
    <header className="nb mt-scope">
      <div className="nb-inner">
        <button
          type="button"
          className="nb-icon-btn nb-burger"
          onClick={() => {
            closeMiniCart();
            setMobileOpen((v) => !v);
          }}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="nb-mobile"
        >
          {mobileOpen ? <CloseIcon /> : <MenuIcon />}
        </button>

        <Link to="/home" className="nb-brand" aria-label="MegaTech home">
          <img src={logo} alt="" />
          <span>MegaTech</span>
        </Link>

        <nav className="nb-links" aria-label="Main">
          {MAIN_LINKS.map(({ to, label }) => (
            <NavLink key={to} to={to} className={(s) => linkClass(s, to)}>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="nb-actions">
          <NavSearch />

          {/* ===== Admin menu (only for signed-in admins) ===== */}
          {isAdmin && (
            <div className="nb-dropdown nb-admin" ref={adminRef}>
              <button
                type="button"
                className={`nb-pill ${openMenu === "admin" ? "is-open" : ""}`}
                onClick={() => toggleMenu("admin")}
                aria-haspopup="menu"
                aria-expanded={openMenu === "admin"}
              >
                <AdminPanelSettingsOutlinedIcon fontSize="small" />
                <span>Admin</span>
                <KeyboardArrowDownIcon fontSize="small" className="nb-chevron" />
              </button>

              {openMenu === "admin" && (
                <div className="nb-menu" role="menu">
                  {ADMIN_LINKS.map(({ to, label, icon: Icon }) => (
                    <Link key={to} to={to} role="menuitem">
                      <Icon fontSize="small" /> {label}
                    </Link>
                  ))}
                  <hr />
                  <button type="button" role="menuitem" onClick={logoutAdmin}>
                    <LogoutIcon fontSize="small" /> Admin sign out
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ===== Account ===== */}
          {user ? (
            <div className="nb-dropdown nb-account" ref={accountRef}>
              <button
                type="button"
                className={`nb-pill ${openMenu === "account" ? "is-open" : ""}`}
                onClick={() => toggleMenu("account")}
                aria-haspopup="menu"
                aria-expanded={openMenu === "account"}
                aria-label="Account menu"
              >
                <span className="nb-avatar">{initial}</span>
                <span className="nb-account__name">{firstName}</span>
                <KeyboardArrowDownIcon fontSize="small" className="nb-chevron" />
              </button>

              {openMenu === "account" && (
                <div className="nb-menu" role="menu">
                  <div className="nb-menu__head">
                    <strong>{user.name}</strong>
                    {user.email && <span>{user.email}</span>}
                  </div>
                  <Link to="/account" role="menuitem">
                    <ManageAccountsOutlinedIcon fontSize="small" /> My account
                  </Link>
                  <Link to="/my-orders" role="menuitem">
                    <ReceiptLongOutlinedIcon fontSize="small" /> My orders
                  </Link>
                  <Link to="/wishlist" role="menuitem">
                    <FavoriteBorderIcon fontSize="small" /> Wishlist
                  </Link>
                  <hr />
                  <button type="button" role="menuitem" onClick={logoutUser}>
                    <LogoutIcon fontSize="small" /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="nb-pill nb-signin">
              <PersonOutlineIcon fontSize="small" />
              <span>Sign in</span>
            </Link>
          )}

          {/* ===== Wishlist ===== */}
          <Link
            to="/wishlist"
            className="nb-icon-btn nb-wish"
            aria-label={`Wishlist, ${wishlist.length} ${wishlist.length === 1 ? "item" : "items"}`}
          >
            <FavoriteBorderIcon />
            {wishlist.length > 0 && <span className="nb-badge">{wishlist.length > 99 ? "99+" : wishlist.length}</span>}
          </Link>

          {/* ===== Cart ===== */}
          <div className="nb-cart" ref={cartRef}>
            <button
              type="button"
              className={`nb-icon-btn nb-cart__btn ${miniCart.open ? "is-open" : ""}`}
              onClick={toggleCart}
              aria-label={`Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
              aria-expanded={miniCart.open}
            >
              <ShoppingCartOutlinedIcon />
              {cartCount > 0 && (
                <span className={`nb-badge ${badgeBump ? "is-bump" : ""}`}>
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </button>

            <MiniCart />
          </div>
        </div>
      </div>

      {/* ===== Phone menu ===== */}
      {mobileOpen && (
        <>
          <div className="nb-mobile-overlay" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <nav className="nb-mobile" id="nb-mobile" aria-label="Mobile">
            {MAIN_LINKS.map(({ to, label }) => (
              <NavLink key={to} to={to} className={(s) => linkClass(s, to)}>
                {label}
              </NavLink>
            ))}

            <div className="nb-mobile__section">
              {user ? (
                <>
                  <div className="nb-mobile__user">
                    <span className="nb-avatar">{initial}</span>
                    <div>
                      <strong>{user.name}</strong>
                      {user.email && <span>{user.email}</span>}
                    </div>
                  </div>
                  <NavLink to="/account" className={(s) => linkClass(s, "/account")}>
                    My account
                  </NavLink>
                  <NavLink to="/my-orders" className={(s) => linkClass(s, "/my-orders")}>
                    My orders
                  </NavLink>
                  <NavLink to="/wishlist" className={(s) => linkClass(s, "/wishlist")}>
                    Wishlist{wishlist.length > 0 ? ` (${wishlist.length})` : ""}
                  </NavLink>
                  <button type="button" className="nb-link" onClick={logoutUser}>
                    Sign out
                  </button>
                </>
              ) : (
                <Link to="/login" className="mt-btn mt-btn--primary mt-btn--block">
                  Sign in
                </Link>
              )}
            </div>

            {isAdmin && (
              <div className="nb-mobile__section">
                <span className="nb-mobile__label">Admin</span>
                {ADMIN_LINKS.map(({ to, label }) => (
                  <NavLink key={to} to={to} className={(s) => linkClass(s, to)}>
                    {label}
                  </NavLink>
                ))}
                <button type="button" className="nb-link" onClick={logoutAdmin}>
                  Admin sign out
                </button>
              </div>
            )}
          </nav>
        </>
      )}
    </header>
  );
};

export default NavBar;
