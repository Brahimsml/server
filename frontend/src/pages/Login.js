import React, { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { API_URL } from "../api";
import "../Styles/Login.css";

const Login = () => {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect");
  const fromCheckout = redirect === "/cart";

  const [isRegister, setIsRegister] = useState(params.get("mode") === "register");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setForm((p) => ({
      ...p,
      [e.target.name]: e.target.value,
    }));
  };

  const switchMode = (register) => {
    setIsRegister(register);
    setMessage({ type: "", text: "" });
  };

  // Save the session and go back to where they came from (e.g. the cart).
  // Only same-site paths, so a link can't redirect people to another website.
  const finishLogin = (data) => {
    sessionStorage.setItem("userToken", data.token);
    sessionStorage.setItem("user", JSON.stringify(data.user));

    const safeRedirect =
      redirect && redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/home";

    window.location.href = safeRedirect;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (!form.email.trim() || !form.password.trim()) {
      setMessage({ type: "error", text: "Email and password are required." });
      return;
    }

    if (isRegister && !form.name.trim()) {
      setMessage({ type: "error", text: "Full name is required." });
      return;
    }

    if (isRegister && form.password.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters." });
      return;
    }

    try {
      setLoading(true);

      if (isRegister) {
        await axios.post(`${API_URL}/users/register`, {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        });
      }

      // After registering, sign in straight away instead of asking again
      const res = await axios.post(`${API_URL}/users/login`, {
        email: form.email.trim(),
        password: form.password,
      });

      finishLogin(res.data);
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Something went wrong. Please try again.",
      });
      setLoading(false);
    }
  };

  const title = isRegister
    ? "Create your account"
    : fromCheckout
    ? "Sign in to complete your order"
    : "Welcome back";

  const subtitle = isRegister
    ? fromCheckout
      ? "Create an account to place your order. Your cart is saved."
      : "It only takes a minute."
    : fromCheckout
    ? "Your cart is saved. Sign in and you'll go straight back to checkout."
    : "Sign in to your MegaTech account.";

  return (
    <section className="auth-page">
      <div className="auth-card">
        <aside className="auth-aside">
          <div>
            <span className="auth-brand">MegaTech</span>
            <p className="auth-tagline">Premium PC components and gaming accessories.</p>
          </div>

          <ul className="auth-perks">
            <li>
              <CheckCircleOutlineIcon fontSize="small" /> Track your orders and their status
            </li>
            <li>
              <CheckCircleOutlineIcon fontSize="small" /> Your cart is saved while you shop
            </li>
            <li>
              <CheckCircleOutlineIcon fontSize="small" /> Order confirmations by email
            </li>
          </ul>
        </aside>

        <div className="auth-main">
          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={!isRegister}
              className={!isRegister ? "is-active" : ""}
              onClick={() => switchMode(false)}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isRegister}
              className={isRegister ? "is-active" : ""}
              onClick={() => switchMode(true)}
            >
              Create account
            </button>
          </div>

          <h1 className="auth-title">{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>

          {message.text && (
            <div className={`auth-alert auth-alert--${message.type}`} role="alert">
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {isRegister && (
              <label className="auth-field">
                <span>Full name</span>
                <input
                  name="name"
                  autoComplete="name"
                  placeholder="Your full name"
                  value={form.name}
                  onChange={handleChange}
                />
              </label>
            )}

            <label className="auth-field">
              <span>Email</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <div className="auth-password">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  placeholder={isRegister ? "At least 8 characters" : "Your password"}
                  value={form.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="auth-password__toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <VisibilityOffOutlinedIcon fontSize="small" />
                  ) : (
                    <VisibilityOutlinedIcon fontSize="small" />
                  )}
                </button>
              </div>
            </label>

            {!isRegister && (
              <Link to="/forgot-password" className="auth-forgot">
                Forgot password?
              </Link>
            )}

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? "Please wait..." : isRegister ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="auth-switch">
            {isRegister ? "Already have an account?" : "New to MegaTech?"}{" "}
            <button type="button" onClick={() => switchMode(!isRegister)}>
              {isRegister ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>
      </div>
    </section>
  );
};

export default Login;
