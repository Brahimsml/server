import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

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
    <div
      style={{
        maxWidth: 420,
        margin: "60px auto",
        padding: 25,
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
      }}
    >
      <h2>Admin Login</h2>

      <input
        value={email}
        placeholder="Email"
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
      />
      <br />
      <br />

      <input
        type="password"
        value={password}
        placeholder="Password"
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
      />
      <br />
      <br />

      <button
        onClick={login}
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 8,
          border: "none",
          background: "goldenrod",
          color: "#fff",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        Login
      </button>
    </div>
  );
};

export default AdminLogin;
