import React, { useEffect, useState } from "react";
import api from "../api";
import { Link } from "react-router-dom";

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
        const res = await api.get("/admin/stats");
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

  if (loading) return <div className="admin-page">Loading dashboard...</div>;
  if (error) return <div className="admin-page">{error}</div>;

  const s = data?.stats || {};
  const recentOrders = data?.recentOrders || [];
  const recentMessages = data?.recentMessages || [];

  return (
    <div className="admin-page">
      <div className="admin-container">

        {/* HEADER */}
        <div className="admin-header">
          <div className="admin-title">
            <h1>Admin Dashboard</h1>
            <p>Overview & latest activity</p>
          </div>

          <div className="admin-actions">
            <button className="btn btn-danger" onClick={logout}>Logout</button>
          </div>
        </div>

        {/* STATS */}
        <div className="admin-grid">
          <div className="col-3 stat">
            <div className="label">Products</div>
            <div className="value">{s.totalProducts}</div>
            <div className="hint">
              <Link to="/products/admin">Manage →</Link>
            </div>
          </div>

          <div className="col-3 stat">
            <div className="label">Places</div>
            <div className="value">{s.totalPlaces}</div>
            <div className="hint">
              <Link to="/places/admin">Manage →</Link>
            </div>
          </div>

          <div className="col-3 stat">
            <div className="label">Orders</div>
            <div className="value">{s.totalOrders}</div>
            <div className="hint">
              <Link to="/orders/admin">Manage →</Link>
            </div>
          </div>

          <div className="col-3 stat">
            <div className="label">Revenue</div>
            <div className="value">
              ${Number(s.totalRevenue || 0).toFixed(2)}
            </div>
            <div className="hint">All-time sales</div>
          </div>

          <div className="col-3 stat">
            <div className="label">Messages</div>
            <div className="value">{s.totalMessages}</div>
            <div className="hint">
              <Link to="/contacts/admin">View →</Link>
            </div>
          </div>
        </div>

        {/* RECENT DATA */}
        <div className="admin-grid" style={{ marginTop: 18 }}>
          {/* ORDERS */}
          <div className="col-6 panel">
            <div className="panel-header">
              <h2>Recent Orders</h2>
            </div>

            <div className="table-wrap">
              <table className="table">
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
                      <td>
                        <span className="badge">{o.status}</span>
                      </td>
                      <td>
                        <Link to={`/orders/${o.id}`} className="btn btn-sm btn-ghost">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {recentOrders.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: "center" }}>
                        No recent orders
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* MESSAGES */}
          <div className="col-6 panel">
            <div className="panel-header">
              <h2>Recent Messages</h2>
            </div>

            <div className="table-wrap">
              <table className="table">
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
                      <td>
                        {m.created_at
                          ? new Date(m.created_at).toLocaleString()
                          : ""}
                      </td>
                    </tr>
                  ))}

                  {recentMessages.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: "center" }}>
                        No messages
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default AdminDashboard;
