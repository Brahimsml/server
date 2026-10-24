import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import LogoutIcon from "@mui/icons-material/Logout";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import api from "../api";
import { clearUserSession, getUserToken, updateStoredUser } from "../utils/auth";
import { useWishlist } from "../Context/WishlistContext";
import "../Styles/theme.css";
import "../Styles/Account.css";

// Customer's own page: details used at checkout, password, quick links
const Account = () => {
  const navigate = useNavigate();
  const token = getUserToken();
  const { items: wishlist } = useWishlist();

  const [account, setAccount] = useState(null);
  const [details, setDetails] = useState({ name: "", phone: "", address: "" });
  const [detailsMsg, setDetailsMsg] = useState(null); // { type, text }
  const [savingDetails, setSavingDetails] = useState(false);

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);
  const [savingPw, setSavingPw] = useState(false);
  const [loadError, setLoadError] = useState("");

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const signInAgain = () => {
    clearUserSession();
    navigate("/login?redirect=/account");
  };

  useEffect(() => {
    document.title = "My account | MegaTech";
    if (!token) {
      navigate("/login?redirect=/account");
      return undefined;
    }
    api
      .get("/users/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        setAccount(res.data);
        setDetails({ name: res.data.name || "", phone: res.data.phone || "", address: res.data.address || "" });
      })
      .catch((err) => {
        if (err.response?.status === 401 || err.response?.status === 403) {
          clearUserSession();
          navigate("/login?redirect=/account");
        } else {
          setLoadError("We couldn't load your account. Please try again.");
        }
      });
    return () => {
      document.title = "MegaTech | PC Components & Gaming Gear";
    };
  }, [token, navigate]);

  const saveDetails = async (e) => {
    e.preventDefault();
    setDetailsMsg(null);
    if (!details.name.trim()) {
      setDetailsMsg({ type: "error", text: "Enter your name." });
      return;
    }
    try {
      setSavingDetails(true);
      const res = await api.put("/users/me", details, auth);
      setAccount(res.data.user);
      updateStoredUser({ name: res.data.user.name });
      setDetailsMsg({ type: "success", text: "Your details were saved." });
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) return signInAgain();
      setDetailsMsg({ type: "error", text: err.response?.data?.message || "We couldn't save your details." });
    } finally {
      setSavingDetails(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwMsg(null);
    if (pw.next.length < 8) {
      setPwMsg({ type: "error", text: "Use at least 8 characters for the new password." });
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwMsg({ type: "error", text: "The new passwords don't match." });
      return;
    }
    try {
      setSavingPw(true);
      await api.put("/users/me/password", { current_password: pw.current, new_password: pw.next }, auth);
      setPw({ current: "", next: "", confirm: "" });
      setPwMsg({ type: "success", text: "Your password was changed." });
    } catch (err) {
      if (err.response?.status === 401) return signInAgain();
      setPwMsg({ type: "error", text: err.response?.data?.message || "We couldn't change your password." });
    } finally {
      setSavingPw(false);
    }
  };

  const signOut = () => {
    clearUserSession();
    window.location.href = "/home";
  };

  if (!account) {
    return (
      <section className="mt-page">
        <div className="mt-container acc">
          {loadError ? (
            <div className="mt-alert mt-alert--error" role="alert">
              {loadError}
            </div>
          ) : (
            <div className="mt-skeleton" style={{ height: 420 }} />
          )}
        </div>
      </section>
    );
  }

  const initial = (account.name || account.email || "?").trim().charAt(0).toUpperCase();
  const memberSince = account.created_at
    ? new Date(account.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "";
  const pwType = showPw ? "text" : "password";

  return (
    <section className="mt-page">
      <div className="mt-container acc">
        <header className="acc-head">
          <span className="acc-avatar">{initial}</span>
          <div>
            <span className="mt-eyebrow">My account</span>
            <h1 className="mt-title">{account.name}</h1>
            <p className="acc-sub">
              {account.email}
              {account.google_linked && <span className="acc-chip">Google sign-in on</span>}
              {memberSince && <span className="acc-since">Customer since {memberSince}</span>}
            </p>
          </div>
        </header>

        <nav className="acc-links" aria-label="Account shortcuts">
          <Link to="/my-orders" className="acc-link">
            <ReceiptLongOutlinedIcon />
            <span>
              <strong>My orders</strong>
              <small>Track, view and cancel orders</small>
            </span>
          </Link>
          <Link to="/wishlist" className="acc-link">
            <FavoriteBorderIcon />
            <span>
              <strong>Wishlist</strong>
              <small>
                {wishlist.length} saved {wishlist.length === 1 ? "product" : "products"}
              </small>
            </span>
          </Link>
          <button type="button" className="acc-link" onClick={signOut}>
            <LogoutIcon />
            <span>
              <strong>Sign out</strong>
              <small>On this device</small>
            </span>
          </button>
        </nav>

        <div className="acc-grid">
          <form className="mt-panel acc-panel" onSubmit={saveDetails} noValidate>
            <h2>Your details</h2>
            <p className="acc-hint">Your phone and address fill in checkout automatically.</p>

            <label className="mt-field">
              <span>Full name</span>
              <input
                value={details.name}
                autoComplete="name"
                onChange={(e) => setDetails((d) => ({ ...d, name: e.target.value }))}
              />
            </label>
            <label className="mt-field">
              <span>Email</span>
              <input value={account.email} readOnly disabled />
            </label>
            <label className="mt-field">
              <span>Phone number</span>
              <input
                type="tel"
                value={details.phone}
                autoComplete="tel"
                placeholder="e.g. 70 123 456"
                onChange={(e) => setDetails((d) => ({ ...d, phone: e.target.value }))}
              />
            </label>
            <label className="mt-field">
              <span>Delivery address</span>
              <textarea
                rows={3}
                value={details.address}
                autoComplete="street-address"
                placeholder="City, street, building, floor"
                onChange={(e) => setDetails((d) => ({ ...d, address: e.target.value }))}
              />
            </label>

            {detailsMsg && (
              <div className={`mt-alert mt-alert--${detailsMsg.type}`} role={detailsMsg.type === "error" ? "alert" : "status"}>
                {detailsMsg.text}
              </div>
            )}
            <button type="submit" className="mt-btn mt-btn--primary" disabled={savingDetails}>
              {savingDetails ? "Saving…" : "Save details"}
            </button>
          </form>

          <form className="mt-panel acc-panel" onSubmit={changePassword} noValidate>
            <h2>Password</h2>
            <p className="acc-hint">
              {account.google_linked
                ? "You can sign in with Google. To also use a password, set one with “Forgot password?” on the sign-in page."
                : "Use at least 8 characters. A mix of letters, numbers and symbols is best."}
            </p>

            <label className="mt-field">
              <span>Current password</span>
              <div className="acc-password">
                <input
                  type={pwType}
                  value={pw.current}
                  autoComplete="current-password"
                  onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide passwords" : "Show passwords"}
                >
                  {showPw ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
                </button>
              </div>
            </label>
            <label className="mt-field">
              <span>New password</span>
              <input
                type={pwType}
                value={pw.next}
                autoComplete="new-password"
                onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
              />
            </label>
            <label className="mt-field">
              <span>Confirm new password</span>
              <input
                type={pwType}
                value={pw.confirm}
                autoComplete="new-password"
                onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
              />
            </label>

            {pwMsg && (
              <div className={`mt-alert mt-alert--${pwMsg.type}`} role={pwMsg.type === "error" ? "alert" : "status"}>
                {pwMsg.text}
              </div>
            )}
            <button type="submit" className="mt-btn mt-btn--secondary" disabled={savingPw}>
              {savingPw ? "Changing…" : "Change password"}
            </button>
            <Link to="/forgot-password" className="acc-forgot">
              Forgot your current password?
            </Link>
          </form>
        </div>
      </div>
    </section>
  );
};

export default Account;
