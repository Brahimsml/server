import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import api from "../api";
import logo from "../Assets/logo.svg";
import { formatMoney, formatOrderDate, orderStatus, paymentLabel } from "../utils/shop";
import "../Styles/Invoice.css";

// Shop details printed on every invoice
const SHOP = {
  name: "MegaTech",
  tagline: "PC components & gaming gear",
  phone: "70 123 456",
  email: "support@megatech.com",
  country: "Lebanon",
};

// Printable A4 invoice / delivery slip for one order (admin only)
const OrderInvoice = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = `Invoice #${id} | MegaTech`;
    api
      .get(`/orders/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.status === 404 ? "This order doesn't exist." : "We couldn't load this order."));
  }, [id]);

  if (error) return <div className="inv-msg">{error}</div>;
  if (!data) return <div className="inv-msg">Loading…</div>;

  const { order, items } = data;
  const placed = formatOrderDate(order.created_at);
  const fee = Number(order.delivery_fee || 0);
  const subtotal = items.reduce((s, it) => s + Number(it.price) * Number(it.quantity), 0);

  return (
    <div className="inv-page">
      <div className="inv-toolbar">
        <Link to={`/orders/${order.id}`} className="inv-tool">
          <ArrowBackIcon fontSize="small" /> Back to order
        </Link>
        <button type="button" className="inv-tool inv-tool--primary" onClick={() => window.print()}>
          <PrintOutlinedIcon fontSize="small" /> Print
        </button>
      </div>

      <article className="inv">
        <header className="inv-head">
          <div className="inv-brand">
            <img src={logo} alt="" />
            <div>
              <strong>{SHOP.name}</strong>
              <span>{SHOP.tagline}</span>
            </div>
          </div>
          <div className="inv-title">
            <h1>Invoice</h1>
            <p>
              Order <strong>#{order.id}</strong>
            </p>
            <p>{placed.date}</p>
          </div>
        </header>

        <section className="inv-parties">
          <div>
            <h2>Deliver to</h2>
            <p>
              <strong>{order.customer_name}</strong>
            </p>
            <p>{order.customer_phone}</p>
            <p>{order.customer_address}</p>
            {order.user_email && <p>{order.user_email}</p>}
          </div>
          <div>
            <h2>From</h2>
            <p>
              <strong>{SHOP.name}</strong>
            </p>
            <p>{SHOP.phone}</p>
            <p>{SHOP.email}</p>
            <p>{SHOP.country}</p>
          </div>
          <div>
            <h2>Order</h2>
            <p>Status: {orderStatus(order.status).label}</p>
            {paymentLabel(order.payment_method) && <p>Payment: {paymentLabel(order.payment_method)}</p>}
            {placed.time && <p>Placed at {placed.time}</p>}
          </div>
        </section>

        <table className="inv-items">
          <thead>
            <tr>
              <th>Product</th>
              <th className="num">Qty</th>
              <th className="num">Price</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td>{it.product_name}</td>
                <td className="num">{it.quantity}</td>
                <td className="num">{formatMoney(it.price)}</td>
                <td className="num">{formatMoney(Number(it.price) * Number(it.quantity))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="inv-totals">
          <div>
            <span>Subtotal</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          <div>
            <span>Delivery</span>
            <span>{fee ? formatMoney(fee) : "Free"}</span>
          </div>
          <div className="inv-totals__grand">
            <span>Total{order.payment_method === "cash" ? " to pay on delivery" : ""}</span>
            <span>{formatMoney(order.total)}</span>
          </div>
        </div>

        <footer className="inv-foot">
          <p>Thank you for shopping with {SHOP.name}!</p>
          <p>
            Returns within 7 days · Questions? Call {SHOP.phone} or email {SHOP.email}
          </p>
          <div className="inv-sign">
            <span>Received by (name &amp; signature)</span>
          </div>
        </footer>
      </article>
    </div>
  );
};

export default OrderInvoice;
