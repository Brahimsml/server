import React, { useEffect, useState } from "react";
import api from "../api";
import { Link } from "react-router-dom";

const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
};

function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const logout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("admin");
    window.location.href = "/admin/login";
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get("/admin/stats"); //  JWT requiredd
        setData(res.data);
      } catch (err) {
        console.error(err);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) return <div style={{ padding: 20 }}>Loading dashboard...</div>;
  if (error) return <div style={{ padding: 20, color: "red" }}>{error}</div>;

  const s = data?.stats || {};
  const recentOrders = data?.recentOrders || [];
  const recentMessages = data?.recentMessages || [];

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Admin Dashboard</h1>
        <button onClick={logout}>Logout</button>
      </div>

      {/*  STATS CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          marginTop: 16,
        }}
      >
        <div style={cardStyle}>
          <h3 style={{ margin: 0, opacity: 0.7 }}>Products</h3>
          <h2 style={{ margin: "10px 0 0" }}>{s.totalProducts}</h2>
          <Link to="/products/admin">Manage →</Link>
        </div>

        <div style={cardStyle}>
          <h3 style={{ margin: 0, opacity: 0.7 }}>Places</h3>
          <h2 style={{ margin: "10px 0 0" }}>{s.totalPlaces}</h2>
          <Link to="/places/admin">Manage →</Link>
        </div>

        <div style={cardStyle}>
          <h3 style={{ margin: 0, opacity: 0.7 }}>Orders</h3>
          <h2 style={{ margin: "10px 0 0" }}>{s.totalOrders}</h2>
          <Link to="/orders/admin">Manage →</Link>
        </div>

        <div style={cardStyle}>
          <h3 style={{ margin: 0, opacity: 0.7 }}>Revenue</h3>
          <h2 style={{ margin: "10px 0 0" }}>${Number(s.totalRevenue || 0).toFixed(2)}</h2>
          <span style={{ fontSize: 12, opacity: 0.6 }}>Sum of all orders</span>
        </div>

        <div style={cardStyle}>
          <h3 style={{ margin: 0, opacity: 0.7 }}>Messages</h3>
          <h2 style={{ margin: "10px 0 0" }}>{s.totalMessages}</h2>
          <Link to="/contacts/admin">View →</Link>
        </div>
      </div>

      {/*  RECENT TABLES */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
          gap: 14,
          marginTop: 18,
        }}
      >
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Recent Orders</h3>

          <table width="100%" border="1" cellPadding="8">
            <thead>
              <tr>
                <th>ID</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>{o.customer_name}</td>
                  <td>${Number(o.total || 0).toFixed(2)}</td>
                  <td>{o.status}</td>
                  <td>
                    <Link to={`/orders/${o.id}`}>View</Link>
                  </td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", padding: 12 }}>
                    No recent orders
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Recent Messages</h3>

          <table width="100%" border="1" cellPadding="8">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentMessages.map((m) => (
                <tr key={m.id}>
                  <td>{m.id}</td>
                  <td>{m.full_name}</td>
                  <td>{m.email}</td>
                  <td>{m.created_at ? new Date(m.created_at).toLocaleString() : ""}</td>
                </tr>
              ))}
              {recentMessages.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ textAlign: "center", padding: 12 }}>
                    No messages
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
