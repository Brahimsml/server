import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CloseIcon from "@mui/icons-material/Close";
import { jwtDecode } from "jwt-decode";
import api from "../../api";
import logo from "../../Assets/logo.jpg";
import "../../Styles/theme.css";
import "../../Styles/AdminPanel.css";

const NAV = [
  { to: "/admin/dashboard", label: "Dashboard", icon: DashboardOutlinedIcon, match: "/admin/dashboard" },
  { to: "/products/admin", label: "Products", icon: Inventory2OutlinedIcon, match: "/products" },
  { to: "/categories/admin", label: "Categories", icon: CategoryOutlinedIcon, match: "/categories" },
  { to: "/places/admin", label: "Stores", icon: StorefrontOutlinedIcon, match: "/places" },
  { to: "/orders/admin", label: "Orders", icon: ReceiptLongOutlinedIcon, match: "/orders" },
  { to: "/contacts/admin", label: "Messages", icon: MailOutlineIcon, match: "/contacts" },
];

// Session: tokens last 1 hour. While the admin is active we renew it before it runs out;
// if they're away, we warn 5 minutes before signing them out.
const MIN = 60 * 1000;
const RENEW_WHEN_LEFT = 15 * MIN;
const WARN_WHEN_LEFT = 5 * MIN;
const ACTIVE_WITHIN = 5 * MIN;
const CHECK_EVERY = 20 * 1000;

const tokenTimeLeft = () => {
  const token = localStorage.getItem("adminToken");
  if (!token) return null;
  try {
    return jwtDecode(token).exp * 1000 - Date.now();
  } catch {
    return null;
  }
};

// notify(message, type) and confirm({...}) for every admin page
const AdminContext = createContext({ notify: () => {}, confirm: async () => false });
export const useAdmin = () => useContext(AdminContext);

export const adminSignOut = (navigate) => {
  localStorage.removeItem("adminToken");
  localStorage.removeItem("admin");
  navigate("/admin/login");
};

const AdminLayout = ({ children }) => {
  const { pathname, search, state } = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [sessionLeft, setSessionLeft] = useState(null);
  const toastId = useRef(0);
  const lastActivity = useRef(Date.now());

  const admin = JSON.parse(localStorage.getItem("admin") || "null");
  const email = admin?.email || "Admin";

  const notify = useCallback((message, type = "success") => {
    const id = ++toastId.current;
    setToasts((list) => [...list, { id, message, type }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), type === "error" ? 6000 : 3500);
  }, []);

  // Promise-based replacement for window.confirm
  const confirm = useCallback(
    (options) => new Promise((resolve) => setDialog({ ...options, resolve })),
    []
  );

  const closeDialog = (answer) => {
    dialog?.resolve(answer);
    setDialog(null);
  };

  // Pages can pass a message when navigating, e.g. after saving a form
  useEffect(() => {
    if (!state?.notice) return;
    notify(state.notice);
    // clear it so a page refresh doesn't show it again
    navigate(pathname + search, { replace: true, state: null });
  }, [state, notify, navigate, pathname, search]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // ===== Session keep-alive =====
  useEffect(() => {
    const mark = () => (lastActivity.current = Date.now());
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((ev) => window.addEventListener(ev, mark, { passive: true }));
    return () => events.forEach((ev) => window.removeEventListener(ev, mark));
  }, []);

  const renewSession = useCallback(async () => {
    try {
      const res = await api.post("/admin/refresh");
      localStorage.setItem("adminToken", res.data.token);
      setSessionLeft(null);
    } catch (err) {
      console.error("Session renew failed", err);
    }
  }, []);

  useEffect(() => {
    let renewing = false;

    const check = async () => {
      const left = tokenTimeLeft();
      if (left === null || renewing) return;

      if (left <= 0) {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("admin");
        navigate("/admin/login", {
          state: { notice: "For your security you were signed out after a period of inactivity. Please sign in again." },
        });
        return;
      }

      const active = Date.now() - lastActivity.current < ACTIVE_WITHIN;
      if (left < RENEW_WHEN_LEFT && active) {
        renewing = true;
        await renewSession();
        renewing = false;
        return;
      }

      setSessionLeft(left < WARN_WHEN_LEFT ? left : null);
    };

    check();
    const timer = setInterval(check, CHECK_EVERY);
    return () => clearInterval(timer);
  }, [navigate, renewSession]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      if (dialog) closeDialog(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const isActive = (match) => pathname === match || pathname.startsWith(match + "/");

  const brand = (
    <Link to="/admin/dashboard" className="ad-brand">
      <img src={logo} alt="" />
      <span>
        <strong>MegaTech</strong>
        <small>Admin</small>
      </span>
    </Link>
  );

  return (
    <AdminContext.Provider value={{ notify, confirm }}>
      <div className={`ad mt-scope ${menuOpen ? "is-menu-open" : ""}`}>
        {/* Phone / tablet top bar */}
        <header className="ad-topbar">
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open admin menu">
            <MenuIcon />
          </button>
          {brand}
        </header>

        <div className="ad-overlay" onClick={() => setMenuOpen(false)} aria-hidden="true" />

        <aside className="ad-side" aria-label="Admin navigation">
          {brand}

          <nav className="ad-nav">
            <span className="ad-nav__label">Manage</span>
            {NAV.map(({ to, label, icon: Icon, match }) => (
              <NavLink key={to} to={to} className={() => (isActive(match) ? "is-active" : "")}>
                <Icon /> {label}
              </NavLink>
            ))}

            <span className="ad-nav__label">Account</span>
            <NavLink to="/admin/settings" className={() => (isActive("/admin/settings") ? "is-active" : "")}>
              <SettingsOutlinedIcon /> Settings
            </NavLink>
          </nav>

          <div className="ad-side__foot">
            <div className="ad-user">
              <span className="ad-user__avatar">{email.charAt(0).toUpperCase()}</span>
              <div style={{ minWidth: 0 }}>
                <strong>Administrator</strong>
                <span title={email}>{email}</span>
              </div>
            </div>
            <Link to="/home">
              <OpenInNewIcon fontSize="small" /> View store
            </Link>
            <button type="button" onClick={() => adminSignOut(navigate)}>
              <LogoutIcon fontSize="small" /> Sign out
            </button>
          </div>
        </aside>

        <main className="ad-main">
          <div className="ad-content">
            {sessionLeft !== null && (
              <div className="ad-session" role="alert">
                <span>
                  For your security, you'll be signed out in about{" "}
                  {Math.max(1, Math.ceil(sessionLeft / MIN))}{" "}
                  {Math.ceil(sessionLeft / MIN) <= 1 ? "minute" : "minutes"}.
                </span>
                <button type="button" className="mt-btn mt-btn--primary mt-btn--sm" onClick={renewSession}>
                  Stay signed in
                </button>
              </div>
            )}
            {children}
          </div>
        </main>

        {/* Toast notifications */}
        <div className="ad-toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`ad-toast ad-toast--${t.type}`} role="status">
              {t.type === "error" ? <ErrorOutlineIcon /> : <CheckCircleOutlineIcon />}
              <span>{t.message}</span>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
              >
                <CloseIcon fontSize="small" />
              </button>
            </div>
          ))}
        </div>

        {/* Confirmation dialog */}
        {dialog && (
          <div className="ad-dialog-backdrop" onClick={() => closeDialog(false)}>
            <div
              className="ad-dialog"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="ad-dialog-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="ad-dialog-title">{dialog.title}</h2>
              <p>{dialog.message}</p>
              <div className="ad-dialog__actions">
                <button type="button" className="mt-btn mt-btn--secondary" onClick={() => closeDialog(false)}>
                  {dialog.cancelLabel || "Cancel"}
                </button>
                <button
                  type="button"
                  className={`mt-btn ${dialog.danger ? "mt-btn--danger" : "mt-btn--primary"}`}
                  onClick={() => closeDialog(true)}
                  autoFocus
                >
                  {dialog.confirmLabel || "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminContext.Provider>
  );
};

export default AdminLayout;
