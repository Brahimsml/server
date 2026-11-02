import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import CheckIcon from "@mui/icons-material/Check";
import GoogleButton, { googleEnabled } from "./GoogleButton";
import { API_URL } from "../api";
import { saveUserSession } from "../utils/auth";

const RESEND_SECONDS = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// How strong a new password is: 0 too short, 1 weak, 2 good, 3 strong
const passwordStrength = (pw) => {
  if (pw.length < 8) return 0;
  let score = 1;
  if (/[a-zA-Z]/.test(pw) && /\d/.test(pw)) score += 1;
  if (pw.length >= 12 || /[^A-Za-z0-9]/.test(pw)) score += 1;
  return score;
};
const STRENGTH = ["Too short", "Weak", "Good", "Strong"];

// Strength bar + what a new password needs (create account and reset password)
export const PasswordHelp = ({ password }) => {
  const strength = passwordStrength(password);
  return (
    <>
      {password && (
        <div className={`auth-strength auth-strength--${strength}`} aria-live="polite">
          <div className="auth-strength__bar" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <span>{STRENGTH[strength]}</span>
        </div>
      )}
      <ul className="auth-checks">
        <li className={password.length >= 8 ? "is-ok" : ""}>
          <CheckIcon fontSize="inherit" /> At least 8 characters
        </li>
        <li className={/[a-zA-Z]/.test(password) && /\d/.test(password) ? "is-ok" : ""}>
          <CheckIcon fontSize="inherit" /> Letters and numbers (recommended)
        </li>
      </ul>
    </>
  );
};

// The account's email in the form (hidden), so the browser's password manager saves or
// updates the password for the right account
export const UsernameForManager = ({ email }) => (
  <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
);

// The 6-digit email code as six boxes: typing moves on, Backspace goes back, pasting fills them all
const CodeBoxes = ({ value, onChange, invalid, describedBy }) => {
  const boxes = useRef([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || "");
  const focus = (i) => boxes.current[Math.max(0, Math.min(5, i))]?.focus();

  const fill = (i, text) => {
    const typed = text.replace(/\D/g, "");
    if (!typed) return;
    const next = (value.slice(0, i) + typed).slice(0, 6);
    onChange(next);
    focus(next.length);
  };

  return (
    <div className="auth-otp" role="group" aria-label="6-digit code" aria-describedby={describedBy}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (boxes.current[i] = el)}
          value={d}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid || undefined}
          maxLength={6}
          autoFocus={i === 0}
          onFocus={(e) => e.target.select()}
          onChange={(e) => fill(i, e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            fill(0, e.clipboardData.getData("text"));
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !d) {
              e.preventDefault();
              onChange(value.slice(0, Math.max(0, i - 1)));
              focus(i - 1);
            } else if (e.key === "Backspace") {
              e.preventDefault();
              onChange(value.slice(0, i));
            } else if (e.key === "ArrowLeft") focus(i - 1);
            else if (e.key === "ArrowRight") focus(i + 1);
          }}
        />
      ))}
    </div>
  );
};

/*
  The sign-in form, email first like Amazon or Google: type your email and Continue, then
  the password step (you have an account) or the create-account step (you're new), then the
  6-digit email code for new accounts. Google sign-in on the first step.
  Used by the Sign in page (pages/Login.js) and the sign-in popup (AuthModal.js), so both
  always work the same.
    initialMode   "login" or "register" (only changes the first title)
    context       "checkout" or "wishlist": a title that says why they're signing in
    onSignedIn    called once the session is saved (the page or popup decides where to go)
    onModeChange  told "register" while creating an account, "login" otherwise
    titleId       id of the title, for the popup's label
*/
const AuthForm = ({ initialMode = "login", context = null, onSignedIn, onModeChange, titleTag: Title = "h1", titleId }) => {
  const [step, setStep] = useState("email"); // email | password | register | verify
  const [hasGoogle, setHasGoogle] = useState(false); // the account has used Google before
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({}); // shown under each field
  const [message, setMessage] = useState({ type: "", text: "" }); // anything not about one field
  const [showPassword, setShowPassword] = useState(false);
  // "Keep me signed in": stay signed in for 30 days, even after closing the browser
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const passwordRef = useRef(null);
  const nameRef = useRef(null);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // the next step's first box gets the cursor
  useEffect(() => {
    if (step === "password") passwordRef.current?.focus();
    if (step === "register") nameRef.current?.focus();
  }, [step]);

  const goTo = (next) => {
    setStep(next);
    setForm((f) => ({ ...f, password: "" })); // a password typed for one step never carries into another
    setErrors({});
    setMessage({ type: "", text: "" });
    setShowPassword(false);
    onModeChange?.(next === "register" ? "register" : "login");
  };

  const set = (name) => (e) => {
    setForm((f) => ({ ...f, [name]: e.target.value }));
    setErrors((er) => ({ ...er, [name]: "" }));
  };

  const finishLogin = (data) => {
    saveUserSession(data, remember);
    onSignedIn?.(data);
  };

  const failed = (err, fallback) => {
    setLoading(false);
    return err.response?.data?.message || fallback;
  };

  // 1. Email → which step comes next
  const handleEmail = async (e) => {
    e.preventDefault();
    const email = form.email.trim();
    if (!EMAIL_RE.test(email)) return setErrors({ email: email ? "Enter a valid email address, like name@example.com." : "Enter your email address." });
    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/users/check-email`, { email });
      setHasGoogle(Boolean(res.data.google));
      setLoading(false);
      goTo(res.data.exists ? "password" : "register");
    } catch (err) {
      setErrors({ email: failed(err, "Something went wrong. Please try again.") });
    }
  };

  // 2a. Password for an existing account
  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!form.password) return setErrors({ password: "Enter your password." });
    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/users/login`, { email: form.email.trim(), password: form.password, remember });
      finishLogin(res.data);
    } catch (err) {
      const data = err.response?.data;
      if (data?.needsVerification) {
        setLoading(false);
        return startVerification(data.email, "Please confirm your email first. We sent you a new code.");
      }
      const text = failed(err, "Something went wrong. Please try again.");
      if (err.response?.status === 401) setErrors({ password: "That password isn't right. Try again or reset it." });
      else setMessage({ type: "error", text });
    }
  };

  // 2b. Name + new password for a new account, then the email code
  const handleRegister = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = "Enter your full name.";
    if (form.password.length < 8) next.password = "Use at least 8 characters.";
    if (next.name || next.password) return setErrors(next);
    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/users/register`, { name: form.name.trim(), email: form.email.trim(), password: form.password });
      setLoading(false);
      startVerification(res.data.email, "Code sent. It can take a minute to arrive.");
    } catch (err) {
      const text = failed(err, "Something went wrong. Please try again.");
      if (err.response?.status === 409) goTo("password");
      else setMessage({ type: "error", text });
    }
  };

  const startVerification = (email, text) => {
    setForm((f) => ({ ...f, email }));
    setCode("");
    setResendIn(RESEND_SECONDS);
    setStep("verify");
    setErrors({});
    setMessage({ type: "success", text });
  };

  // 3. The 6-digit code (checked as soon as all six are in)
  const verify = async (value) => {
    if (value.length !== 6) return setErrors({ code: "Enter all 6 digits from the email." });
    try {
      setLoading(true);
      setMessage({ type: "", text: "" });
      const res = await axios.post(`${API_URL}/users/verify-email`, { email: form.email.trim(), code: value, remember });
      finishLogin(res.data);
    } catch (err) {
      const data = err.response?.data;
      const text = failed(err, "Something went wrong. Please try again.");
      if (data?.alreadyVerified) {
        goTo("password");
        setMessage({ type: "error", text });
      } else {
        setErrors({ code: text });
        setCode("");
      }
    }
  };

  const changeCode = (value) => {
    setCode(value);
    setErrors({});
    if (value.length === 6 && !loading) verify(value);
  };

  const handleResend = async () => {
    setMessage({ type: "", text: "" });
    setErrors({});
    try {
      await axios.post(`${API_URL}/users/resend-code`, { email: form.email.trim() });
      setCode("");
      setResendIn(RESEND_SECONDS);
      setMessage({ type: "success", text: "New code sent. Use the latest one." });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Couldn't send a new code. Please try again." });
    }
  };

  const handleGoogle = async (credential) => {
    setMessage({ type: "", text: "" });
    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/users/google`, { credential, remember });
      finishLogin(res.data);
    } catch (err) {
      setMessage({ type: "error", text: failed(err, "Google sign-in failed. Please try again.") });
    }
  };

  // ----- pieces -----
  const alert = message.text && (
    <div className={`auth-alert auth-alert--${message.type}`} role={message.type === "error" ? "alert" : "status"}>
      {message.text}
    </div>
  );

  const fieldError = (name) =>
    errors[name] && (
      <span className="auth-field-error" id={`auth-err-${name}`} role="alert">
        {errors[name]}
      </span>
    );

  const inputProps = (name) => ({
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `auth-err-${name}` : undefined,
    className: errors[name] ? "is-invalid" : undefined,
  });

  // the email they're using, with a way back to change it
  const who = (
    <div className="auth-who">
      <span title={form.email}>{form.email}</span>
      <button type="button" onClick={() => goTo("email")}>
        Change
      </button>
    </div>
  );

  const passwordField = (autoComplete, placeholder) => (
    <label className="auth-field">
      <span>Password</span>
      <div className="auth-password">
        <input
          ref={passwordRef}
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={form.password}
          onChange={set("password")}
          {...inputProps("password")}
        />
        <button
          type="button"
          className="auth-password__toggle"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
        </button>
      </div>
      {fieldError("password")}
    </label>
  );

  const keepSignedIn = (
    <label className="auth-remember">
      <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
      <span>Keep me signed in</span>
    </label>
  );

  const legal = (
    <p className="auth-legal">
      <LockOutlinedIcon fontSize="inherit" />
      <span>
        Secure sign-in. By continuing you agree to our <Link to="/terms">Terms</Link> and{" "}
        <Link to="/privacy" className="auth-legal__nowrap">
          Privacy Policy
        </Link>
        .
      </span>
    </p>
  );

  // ----- steps -----
  if (step === "verify") {
    return (
      <>
        <div className="auth-done__icon auth-verify__icon">
          <MarkEmailReadOutlinedIcon fontSize="inherit" />
        </div>
        <Title className="auth-title auth-verify__title" id={titleId}>
          Check your email
        </Title>
        <p className="auth-subtitle auth-verify__title">
          Enter the 6-digit code we sent to <strong className="auth-verify__email">{form.email}</strong>. It expires in 15 minutes.
        </p>

        {alert}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify(code);
          }}
          noValidate
        >
          <div className="auth-field">
            <CodeBoxes value={code} onChange={changeCode} invalid={Boolean(errors.code)} describedBy={errors.code ? "auth-err-code" : undefined} />
            {fieldError("code")}
          </div>
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
          <button type="button" onClick={() => goTo("email")}>
            Use a different email
          </button>
        </p>
      </>
    );
  }

  if (step === "password") {
    return (
      <>
        <Title className="auth-title" id={titleId}>
          {context === "checkout" ? "Sign in to complete your order" : "Welcome back"}
        </Title>
        <p className="auth-subtitle">Enter your password to sign in.</p>
        {who}
        {alert}
        {hasGoogle && googleEnabled && (
          <p className="auth-hint">
            You've used Google with this email. You can{" "}
            <button type="button" onClick={() => goTo("email")}>
              continue with Google
            </button>{" "}
            instead.
          </p>
        )}

        <form onSubmit={handleSignIn} noValidate>
          <UsernameForManager email={form.email.trim()} />
          {passwordField("current-password", "Your password")}
          <div className="auth-options">
            {keepSignedIn}
            <Link to="/forgot-password" state={{ email: form.email.trim() }} className="auth-forgot">
              Forgot password?
            </Link>
          </div>
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        {legal}
      </>
    );
  }

  if (step === "register") {
    return (
      <>
        <Title className="auth-title" id={titleId}>
          Create your account
        </Title>
        <p className="auth-subtitle">
          {context === "checkout" ? "You're new here. Create an account to place your order; your cart is saved." : "You're new here. It only takes a minute."}
        </p>
        {who}
        {alert}

        <form onSubmit={handleRegister} noValidate>
          <UsernameForManager email={form.email.trim()} />
          <label className="auth-field">
            <span>Full name</span>
            <input ref={nameRef} name="name" autoComplete="name" placeholder="Your full name" value={form.name} onChange={set("name")} {...inputProps("name")} />
            {fieldError("name")}
          </label>

          {passwordField("new-password", "At least 8 characters")}
          <PasswordHelp password={form.password} />

          <div className="auth-options">{keepSignedIn}</div>
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Please wait..." : "Create account"}
          </button>
          <p className="auth-note">We'll email you a 6-digit code to confirm it's you.</p>
        </form>
        {legal}
      </>
    );
  }

  // step "email"
  const title =
    context === "checkout"
      ? "Sign in to complete your order"
      : context === "wishlist"
      ? "Sign in to keep your wishlist"
      : initialMode === "register"
      ? "Create your account"
      : "Sign in or create an account";
  const subtitle =
    context === "checkout"
      ? "Your cart is saved. Enter your email to sign in or create an account."
      : context === "wishlist"
      ? "Your saved products move to your account, so you see them on every device."
      : "Enter your email to continue. New here? We'll set up your account next.";

  return (
    <>
      <Title className="auth-title" id={titleId}>
        {title}
      </Title>
      <p className="auth-subtitle">{subtitle}</p>

      {alert}

      {googleEnabled && (
        <>
          <GoogleButton onCredential={handleGoogle} onError={(text) => setMessage({ type: "error", text })} text="continue_with" />
          <div className="auth-divider">
            <span>or with email</span>
          </div>
        </>
      )}

      <form onSubmit={handleEmail} noValidate>
        <label className="auth-field">
          <span>Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={set("email")}
            {...inputProps("email")}
          />
          {fieldError("email")}
        </label>
        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? "Checking..." : "Continue"}
        </button>
      </form>
      {legal}
    </>
  );
};

export default AuthForm;
