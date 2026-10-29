import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import MarkEmailUnreadOutlinedIcon from "@mui/icons-material/MarkEmailUnreadOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import GoogleButton, { googleEnabled } from "../Components/GoogleButton";
import { API_URL } from "../api";
import { saveUserSession } from "../utils/auth";
import "../Styles/Login.css";
import logo from "../Assets/logo.jpg";
import setupPhoto from "../Assets/apo.jpeg";
import usePageTitle from "../utils/usePageTitle";

const RESEND_SECONDS = 60;

const Login = () => {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect");
  const fromCheckout = redirect === "/cart";

  const [isRegister, setIsRegister] = useState(params.get("mode") === "register");
  usePageTitle(isRegister ? "Create account" : "Sign in");
  const [showPassword, setShowPassword] = useState(false);
  // "Keep me signed in": stay signed in for 30 days, even after closing the browser
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  // Email confirmation step: set to the email we sent the code to
  const [verifyEmail, setVerifyEmail] = useState("");
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

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
    saveUserSession(data, remember);

    const safeRedirect =
      redirect && redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/home";

    window.location.href = safeRedirect;
  };

  const startVerification = (email, text) => {
    setVerifyEmail(email);
    setCode("");
    setResendIn(RESEND_SECONDS);
    setMessage({ type: "success", text });
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
        const res = await axios.post(`${API_URL}/users/register`, {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        });
        startVerification(res.data.email, "Code sent. It can take a minute to arrive.");
        setLoading(false);
        return;
      }

      const res = await axios.post(`${API_URL}/users/login`, {
        email: form.email.trim(),
        password: form.password,
        remember,
      });

      finishLogin(res.data);
    } catch (err) {
      const data = err.response?.data;
      if (data?.needsVerification) {
        startVerification(data.email, "Please confirm your email first. We sent you a new code.");
      } else if (isRegister && err.response?.status === 409) {
        setMessage({ type: "error", kind: "exists", text: "This email already has an account." });
      } else {
        setMessage({ type: "error", text: data?.message || "Something went wrong. Please try again." });
      }
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (code.length !== 6) {
      setMessage({ type: "error", text: "Enter the 6-digit code from the email." });
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/users/verify-email`, { email: verifyEmail, code, remember });
      finishLogin(res.data);
    } catch (err) {
      const data = err.response?.data;
      if (data?.alreadyVerified) {
        setVerifyEmail("");
        switchMode(false);
      }
      setMessage({ type: "error", text: data?.message || "Something went wrong. Please try again." });
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setMessage({ type: "", text: "" });
    try {
      await axios.post(`${API_URL}/users/resend-code`, { email: verifyEmail });
      setCode("");
      setResendIn(RESEND_SECONDS);
      setMessage({ type: "success", text: "New code sent. Use the latest one." });
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Couldn't send a new code. Please try again.",
      });
    }
  };

  const handleGoogle = async (credential) => {
    setMessage({ type: "", text: "" });
    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/users/google`, { credential, remember });
      finishLogin(res.data);
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Google sign-in failed. Please try again.",
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

  const alert = message.text && (
    <div className={`auth-alert auth-alert--${message.type}`} role={message.type === "error" ? "alert" : "status"}>
      {message.text}
      {message.kind === "exists" && (
        <span className="auth-alert__actions">
          <button type="button" onClick={() => switchMode(false)}>
            Sign in
          </button>
          {" or "}
          <Link to="/forgot-password" state={{ email: form.email.trim() }}>
            reset your password
          </Link>
        </span>
      )}
    </div>
  );

  const verifyStep = (
    <>
      <div className="auth-done__icon auth-verify__icon">
        <MarkEmailReadOutlinedIcon fontSize="inherit" />
      </div>
      <h1 className="auth-title auth-verify__title">Check your email</h1>
      <p className="auth-subtitle auth-verify__title">
        Enter the 6-digit code we sent to <strong className="auth-verify__email">{verifyEmail}</strong>. It
        expires in 15 minutes.
      </p>

      {alert}

      <form onSubmit={handleVerify} noValidate>
        <label className="auth-field">
          <span>Confirmation code</span>
          <input
            className="auth-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoFocus
          />
        </label>

        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? "Checking..." : "Confirm email"}
        </button>
      </form>

      <p className="auth-switch">
        Didn't get it? Check your spam folder or{" "}
        <button type="button" onClick={handleResend} disabled={resendIn > 0}>
          {resendIn > 0 ? `resend in ${resendIn}s` : "send a new code"}
        </button>
      </p>
      <p className="auth-switch auth-verify__back">
        <button
          type="button"
          onClick={() => {
            setVerifyEmail("");
            setMessage({ type: "", text: "" });
          }}
        >
          Use a different email
        </button>
      </p>
    </>
  );

  const formStep = (
    <>
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

      {alert}

      {googleEnabled && (
        <>
          <GoogleButton
            onCredential={handleGoogle}
            onError={(text) => setMessage({ type: "error", text })}
            text={isRegister ? "signup_with" : "continue_with"}
          />
          <div className="auth-divider">
            <span>or with email</span>
          </div>
        </>
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

        <div className="auth-options">
          <label className="auth-remember">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>Keep me signed in</span>
          </label>
          {!isRegister && (
            <Link to="/forgot-password" className="auth-forgot">
              Forgot password?
            </Link>
          )}
        </div>

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

      <p className="auth-legal">
        <LockOutlinedIcon fontSize="inherit" />
        <span>
          Secure sign-in. By continuing you agree to our <Link to="/terms">Terms</Link> and{" "}
          <Link to="/privacy">Privacy Policy</Link>.
        </span>
      </p>
    </>
  );

  return (
    <section className="auth-page">
      <div className="auth-card">
        <aside className="auth-aside" style={{ "--auth-photo": `url(${setupPhoto})` }}>
          <Link to="/home" className="auth-logo" aria-label="MegaTech home">
            <img src={logo} alt="" />
            <span className="auth-brand">MegaTech</span>
          </Link>

          <div className="auth-aside__copy">
            <h2 className="auth-headline">
              Your next setup <span>starts here.</span>
            </h2>
            <p className="auth-tagline">
              One account for your orders, your wishlist and faster checkout, on every device.
            </p>

            <ul className="auth-perks">
              <li>
                <span className="auth-perks__icon">
                  <LocalShippingOutlinedIcon fontSize="small" />
                </span>
                <span>
                  <strong>Track every order</strong>
                  <small>See where your order is, from confirmed to delivered.</small>
                </span>
              </li>
              <li>
                <span className="auth-perks__icon">
                  <FavoriteBorderIcon fontSize="small" />
                </span>
                <span>
                  <strong>Wishlist on all your devices</strong>
                  <small>Save gear on your phone, buy it later on your laptop.</small>
                </span>
              </li>
              <li>
                <span className="auth-perks__icon">
                  <BoltOutlinedIcon fontSize="small" />
                </span>
                <span>
                  <strong>Faster checkout</strong>
                  <small>Your phone and address are filled in for you.</small>
                </span>
              </li>
              <li>
                <span className="auth-perks__icon">
                  <MarkEmailUnreadOutlinedIcon fontSize="small" />
                </span>
                <span>
                  <strong>Order updates by email</strong>
                  <small>A confirmation for every order you place.</small>
                </span>
              </li>
            </ul>
          </div>

          <p className="auth-trust">Cash on delivery · 7-day returns · Delivery all over Lebanon</p>
        </aside>

        <div className="auth-main">{verifyEmail ? verifyStep : formStep}</div>
      </div>
    </section>
  );
};

export default Login;
