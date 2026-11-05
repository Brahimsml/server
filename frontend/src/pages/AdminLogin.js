import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import api from "../api";
import logo from "../Assets/logo.svg";
import "../Styles/theme.css";
import "../Styles/AdminPanel.css";

// "Trust this device": lets this browser skip the emailed code for 30 days (kept after signing out)
const DEVICE_KEY = "adminDevice";
const readDevice = () => {
  try {
    return localStorage.getItem(DEVICE_KEY) || undefined;
  } catch {
    return undefined;
  }
};

/*
  Admin sign-in in 2 steps: email + password, then the 6-digit code emailed to the shop owner
  (skipped on a trusted device).
*/
const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  // step 2: { ticket, sentTo, minutes } after the right password
  const [step, setStep] = useState(null);
  const [code, setCode] = useState("");
  const [trust, setTrust] = useState(true);

  const navigate = useNavigate();
  // e.g. "you were signed out after a period of inactivity"
  const notice = useLocation().state?.notice;

  // Already signed in: go straight to the dashboard
  if (localStorage.getItem("adminToken")) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const login = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email.trim() || !password.trim()) {
      setErrorMsg("Email and password are required.");
      return;
    }

    try {
      setLoading(true);

      const res = await api.post("/admin/login", {
        email: email.trim(),
        password,
        device: readDevice(),
      });

      if (res.data.needsCode) {
        setStep(res.data);
        setCode("");
        setLoading(false);
        return;
      }
      signedIn(res.data);
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || "Invalid credentials.");
      setLoading(false);
    }
  };

  const signedIn = (data) => {
    localStorage.setItem("adminToken", data.token);
    localStorage.setItem("admin", JSON.stringify(data.admin));
    if (data.device) {
      try {
        localStorage.setItem(DEVICE_KEY, data.device);
      } catch {}
    }
    navigate("/admin/dashboard");
  };

  const sendCode = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    if (code.length !== 6) {
      setErrorMsg("Enter the 6-digit code from the email.");
      return;
    }
    try {
      setLoading(true);
      const res = await api.post("/admin/login/code", { ticket: step.ticket, code, trust });
      signedIn(res.data);
    } catch (err) {
      const data = err?.response?.data;
      setErrorMsg(data?.message || "That code isn't right.");
      if (data?.expired) {
        setStep(null);
        setPassword("");
      }
      setCode("");
      setLoading(false);
    }
  };

  const backToPassword = () => {
    setStep(null);
    setErrorMsg("");
    setPassword("");
  };

  return (
    <section className="ad-login mt-scope">
      <div className="ad-login__card">
        <div className="ad-login__brand">
          <img src={logo} alt="" />
          <div>
            <strong>MegaTech</strong>
            <small>Admin</small>
          </div>
        </div>

        {step ? (
          <>
            <h1>Check your email</h1>
            <p className="ad-login__sub">
              <MarkEmailReadOutlinedIcon fontSize="small" className="ad-login__mail" /> We sent a 6-digit code to <strong>{step.sentTo}</strong>. It works for{" "}
              {step.minutes} minutes.
            </p>
          </>
        ) : (
          <>
            <h1>Sign in</h1>
            <p className="ad-login__sub">Manage products, stores, orders and customer messages.</p>
          </>
        )}

        {notice && !errorMsg && (
          <div className="mt-alert mt-alert--info" role="status">
            {notice}
          </div>
        )}

        {errorMsg && (
          <div className="mt-alert mt-alert--error" role="alert">
            {errorMsg}
          </div>
        )}

        {step ? (
          <form onSubmit={sendCode} noValidate>
            <label className="mt-field">
              <span>Code</span>
              <input
                className="ad-login__code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                placeholder="••••••"
                autoFocus
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </label>

            <label className="ad-login__trust">
              <input type="checkbox" className="ad-check" checked={trust} onChange={(e) => setTrust(e.target.checked)} />
              <span>
                Trust this device for 30 days
                <small>Don't tick this on a shared or public computer.</small>
              </span>
            </label>

            <button type="submit" className="mt-btn mt-btn--primary mt-btn--block" disabled={loading}>
              {loading ? "Checking..." : "Sign in"}
            </button>
            <button type="button" className="ad-login__back" onClick={backToPassword}>
              Didn't get it? Sign in again for a new code
            </button>
          </form>
        ) : (
          <form onSubmit={login} noValidate>
            <label className="mt-field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                placeholder="admin@example.com"
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="mt-field">
              <span>Password</span>
              <div className="ad-password">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  placeholder="Your password"
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
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

            <button type="submit" className="mt-btn mt-btn--primary mt-btn--block" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        )}

        <div className="ad-login__foot">
          <Link to="/home">
            <ArrowBackIcon fontSize="small" /> Back to the store
          </Link>
        </div>
      </div>
    </section>
  );
};

export default AdminLogin;
