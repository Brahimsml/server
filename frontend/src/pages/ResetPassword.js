import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { API_URL } from "../api";
import "../Styles/Login.css";
import usePageTitle from "../utils/usePageTitle";

const ResetPassword = () => {
  usePageTitle("Choose a new password");
  const [params] = useSearchParams();
  const id = params.get("id");
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [linkBroken, setLinkBroken] = useState(!id || !token);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${API_URL}/users/reset-password`, { id, token, password });
      setDone(true);
    } catch (err) {
      const msg = err.response?.data?.message || "Something went wrong. Please try again.";
      if (/invalid or has expired/i.test(msg)) setLinkBroken(true);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  let content;
  if (done) {
    content = (
      <div className="auth-done" role="status">
        <div className="auth-done__icon">
          <CheckCircleOutlineIcon fontSize="inherit" />
        </div>
        <h1 className="auth-title">Password changed</h1>
        <p className="auth-subtitle">You can now sign in with your new password.</p>
        <Link to="/login" className="auth-submit" style={{ display: "block", textDecoration: "none", textAlign: "center" }}>
          Sign in
        </Link>
      </div>
    );
  } else if (linkBroken) {
    content = (
      <div className="auth-done">
        <h1 className="auth-title">This link doesn't work</h1>
        <p className="auth-subtitle">
          Reset links expire after 30 minutes and can only be used once. Request a new one and use it
          right away.
        </p>
        <Link to="/forgot-password" className="auth-submit" style={{ display: "block", textDecoration: "none", textAlign: "center" }}>
          Request a new link
        </Link>
      </div>
    );
  } else {
    const type = show ? "text" : "password";
    content = (
      <>
        <h1 className="auth-title">Choose a new password</h1>
        <p className="auth-subtitle">Use at least 8 characters. A mix of letters, numbers and symbols is best.</p>

        {error && (
          <div className="auth-alert auth-alert--error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <label className="auth-field">
            <span>New password</span>
            <div className="auth-password">
              <input
                type={type}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                className="auth-password__toggle"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide passwords" : "Show passwords"}
              >
                {show ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
              </button>
            </div>
          </label>

          <label className="auth-field">
            <span>Confirm new password</span>
            <input type={type} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Saving…" : "Change password"}
          </button>
        </form>
      </>
    );
  }

  return (
    <section className="auth-page">
      <div className="auth-card auth-card--narrow">
        <div className="auth-main">{content}</div>
      </div>
    </section>
  );
};

export default ResetPassword;
