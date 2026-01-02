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
      <div className="admin-page">
        <div className="admin-container panel panel-body">
          <p style={{ color: "var(--danger)" }}>{error}</p>
          <Link to="/orders/admin" className="btn btn-ghost btn-sm">
            Back
          </Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="admin-page">
        <div className="admin-container panel panel-body">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-container">

        {/* Header */}
        <div className="admin-header">
          <div className="admin-title">
            <h1>Order #{order.id}</h1>
            <p>Order details & purchased items</p>
          </div>

          <Link to="/orders/admin" className="btn btn-ghost btn-sm">
            ⬅ Back
          </Link>
        </div>

        {/* Order Info */}
        <div className="panel">
          <div className="panel-header">
            <h2>Customer Information</h2>
          </div>

          <div className="panel-body admin-grid">
            <div className="col-6">
              <p><b>Name:</b> {order.customer_name}</p>
              <p><b>Phone:</b> {order.customer_phone}</p>
            </div>

            <div className="col-6">
              <p><b>Address:</b> {order.customer_address}</p>
              <p>
                <b>Status:</b>{" "}
                <span className="badge badge-new">{order.status}</span>
              </p>
              <p>
                <b>Total:</b>{" "}
                ${Number(order.total || 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="panel" style={{ marginTop: 20 }}>
          <div className="panel-header">
            <h2>Order Items</h2>
          </div>

          <div className="panel-body table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product ID</th>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Qty</th>
                  <th>Subtotal</th>
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
                    <td colSpan="5" style={{ textAlign: "center" }}>
                      No items in this order
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

export default OrderDetails;
