import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");

  const fetchOrders = async () => {
    try {
      const res = await api.get("/orders"); // GET public
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
    try {
      await api.delete(`/orders/${id}`); //  token included
      fetchOrders();
    } catch (err) {
      console.error(err);
      alert("Failed to delete order");
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ textAlign: "center" }}>Admin Orders</h1>

      {error && (
        <div style={{ background: "#ffecec", padding: 10, borderRadius: 8 }}>
          {error}
        </div>
      )}

      <table border="1" width="100%" cellPadding="10" style={{ marginTop: 20 }}>
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
              <td>{o.id}</td>
              <td>{o.customer_name}</td>
              <td>{o.customer_phone}</td>
              <td>{o.customer_address}</td>
              <td>${Number(o.total || 0).toFixed(2)}</td>
              <td>{o.status}</td>
              <td>{o.created_at ? new Date(o.created_at).toLocaleString() : ""}</td>

              <td style={{ display: "flex", gap: 10 }}>
                <Link to={`/orders/${o.id}`} style={{ textDecoration: "none" }}>
                  <button>View</button>
                </Link>

                <button onClick={() => handleDelete(o.id)}>Delete</button>
              </td>
            </tr>
          ))}

          {orders.length === 0 && (
            <tr>
              <td colSpan="8" style={{ textAlign: "center", padding: 20 }}>
                No orders yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default AdminOrders;
