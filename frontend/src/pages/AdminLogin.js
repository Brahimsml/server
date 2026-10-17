import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import api from "../api";
import logo from "../Assets/logo.jpg";
import "../Styles/theme.css";
import "../Styles/AdminPanel.css";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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
      });

      localStorage.setItem("adminToken", res.data.token);
      localStorage.setItem("admin", JSON.stringify(res.data.admin));

      navigate("/admin/dashboard");
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || "Invalid credentials.");
      setLoading(false);
    }
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

        <h1>Sign in</h1>
        <p className="ad-login__sub">Manage products, stores, orders and customer messages.</p>

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
