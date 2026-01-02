import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "../Styles/admin.css"; // ✅ same admin styles

function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");

  const fetchOrders = async () => {
    try {
      const res = await api.get("https://server-2plo.onrender.com/orders");
      setOrders(res.data);
    } catch (err) {
      console.error(err);
      setError("Failed to load orders");
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this order?")) return;

    try {
      await api.delete(`/orders/${id}`);
      fetchOrders();
    } catch (err) {
      console.error(err);
      alert("Failed to delete order");
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-container">
        {/* Header */}
        <div className="admin-header">
          <div className="admin-title">
            <h1>Orders Admin</h1>
            <p>View and manage customer orders</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="panel" style={{ marginBottom: 20 }}>
            <span className="badge">{error}</span>
          </div>
        )}

        {/* Orders Table */}
        <div className="panel">
          <div className="panel-header">
            <h2>All Orders</h2>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <span className="badge">#{o.id}</span>
                    </td>

                    <td>
                      <b>{o.customer_name}</b>
                    </td>

                    <td>{o.customer_phone}</td>

                    <td style={{ maxWidth: 220 }}>{o.customer_address}</td>

                    <td>
                      <b style={{ color: "gold" }}>
                        ${Number(o.total || 0).toFixed(2)}
                      </b>
                    </td>

                    <td>
                      <span className="badge">
                        {o.status || "Pending"}
                      </span>
                    </td>

                    <td>
                      {o.created_at
                        ? new Date(o.created_at).toLocaleString()
                        : "-"}
                    </td>

                    <td style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <Link to={`/orders/${o.id}`}>
                        <button className="btn btn-sm btn-success">
                          View
                        </button>
                      </Link>

                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(o.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}

                {orders.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center", padding: 20 }}>
                      <span className="badge">No orders yet</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

export default AdminOrders;
