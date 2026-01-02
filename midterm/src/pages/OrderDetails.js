import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";

function OrderDetails() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await api.get(`/orders/${id}`);
        setOrder(res.data.order);
        setItems(res.data.items || []);
      } catch (err) {
        console.error(err);
        setError("Order not found or server error");
      }
    };

    fetchOrder();
  }, [id]);

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <p style={{ color: "red" }}>{error}</p>
        <Link to="/orders/admin">Back</Link>
      </div>
    );
  }

  if (!order) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h1>Order Details (#{order.id})</h1>

      <div style={{ background: "#fff", padding: 15, borderRadius: 10, marginBottom: 20 }}>
        <p><b>Name:</b> {order.customer_name}</p>
        <p><b>Phone:</b> {order.customer_phone}</p>
        <p><b>Address:</b> {order.customer_address}</p>
        <p><b>Status:</b> {order.status}</p>
        <p><b>Total:</b> ${Number(order.total || 0).toFixed(2)}</p>
      </div>

      <h3>Items</h3>
      <table border="1" width="100%" cellPadding="10">
        <thead>
          <tr>
            <th>Product ID</th>
            <th>Name</th>
            <th>Price</th>
            <th>Quantity</th>
            <th>SubTotal</th>
          </tr>
        </thead>

        <tbody>
          {items.map((it, index) => {
            const price = Number(it.price || 0);
            const qty = Number(it.quantity || 1);
            return (
              <tr key={index}>
                <td>{it.product_id}</td>
                <td>{it.product_name}</td>
                <td>${price.toFixed(2)}</td>
                <td>{qty}</td>
                <td>${(price * qty).toFixed(2)}</td>
              </tr>
            );
          })}

          {items.length === 0 && (
            <tr>
              <td colSpan="5" style={{ textAlign: "center", padding: 20 }}>
                No items in this order
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ marginTop: 20 }}>
        <Link to="/orders/admin">⬅ Back to Orders</Link>
      </div>
    </div>
  );
}

export default OrderDetails;
