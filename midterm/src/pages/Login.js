import React, { useState } from "react";

const Login = () => {
  const [form, setForm] = useState({ email: "", password: "" });

  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert("User login is UI only ✅. Admin login is: /admin/login");
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
      <h2 style={{ marginBottom: 15 }}>User Login</h2>

      <form onSubmit={handleSubmit}>
        <input
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          style={{
            width: "100%",
            padding: 10,
            marginBottom: 10,
            borderRadius: 8,
            border: "1px solid #ddd",
          }}
        />

        <input
          name="password"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          style={{
            width: "100%",
            padding: 10,
            marginBottom: 10,
            borderRadius: 8,
            border: "1px solid #ddd",
          }}
        />

        <button
          type="submit"
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
      </form>

      <p style={{ marginTop: 12, fontSize: 14 }}>
        Admin login page: <b>/admin/login</b>
      </p>
    </div>
  );
};

export default Login;
