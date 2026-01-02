import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "../Styles/AdminLogin.css";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const login = async () => {
    try {
      const res = await api.post("/admin/login", { email, password });

      localStorage.setItem("adminToken", res.data.token);
      localStorage.setItem("admin", JSON.stringify(res.data.admin));

      navigate("/products/admin");
    } catch (err) {
      alert(err?.response?.data?.message || "Invalid credentials");
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <h2 className="admin-login-title">Admin Login</h2>

        <input
          value={email}
          placeholder="Email"
          onChange={(e) => setEmail(e.target.value)}
          className="admin-input"
        />

        <input
          type="password"
          value={password}
          placeholder="Password"
          onChange={(e) => setPassword(e.target.value)}
          className="admin-input"
        />

        <button onClick={login} className="admin-login-btn">
          Login
        </button>
      </div>
    </div>
  );
};

export default AdminLogin;
