import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { API_URL } from "../api";
import "../Styles/Login.css";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ForgotPassword = () => {
  // filled in when coming from "This email already has an account" on the sign-up form
  const { state } = useLocation();
  const [email, setEmail] = useState(state?.email || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${API_URL}/users/forgot-password`, { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-page">
      <div className="auth-card auth-card--narrow">
        <div className="auth-main">
          {sent ? (
            <div className="auth-done" role="status">
              <div className="auth-done__icon">
                <MarkEmailReadOutlinedIcon fontSize="inherit" />
              </div>
              <h1 className="auth-title">Check your email</h1>
              <p className="auth-subtitle">
                If an account exists for <strong>{email.trim()}</strong>, we've sent a link to reset
                your password. The link works for 30 minutes. Don't forget to check your spam folder.
              </p>
              <Link to="/login" className="auth-submit" style={{ display: "block", textDecoration: "none", textAlign: "center" }}>
                Back to sign in
              </Link>
              <p className="auth-switch">
                Didn't get it?{" "}
                <button type="button" onClick={() => setSent(false)}>
                  Send it again
                </button>
              </p>
            </div>
          ) : (
            <>
              <h1 className="auth-title">Forgot your password?</h1>
              <p className="auth-subtitle">
                Enter the email you use for MegaTech and we'll send you a link to choose a new password.
              </p>

              {error && (
                <div className="auth-alert auth-alert--error" role="alert">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <label className="auth-field">
                  <span>Email</span>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                  />
                </label>

                <button type="submit" className="auth-submit" disabled={loading}>
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>

              <p className="auth-switch">
                <Link to="/login" className="auth-forgot" style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <ArrowBackIcon fontSize="inherit" /> Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default ForgotPassword;
