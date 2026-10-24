import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckIcon from "@mui/icons-material/Check";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import api from "../api";
import {
  formatMoney,
  formatOrderDate,
  imageUrl,
  onImageError,
  orderStatus,
  paymentLabel,
  FALLBACK_IMG,
} from "../utils/shop";
import "../Styles/theme.css";
import "../Styles/Orders.css";
import { clearUserSession, getUserToken } from "../utils/auth";

// Steps shown in the progress tracker
const STEPS = [
  { key: "pending", label: "Order placed" },
  { key: "processing", label: "Processing" },
  { key: "done", label: "Completed" },
];

function MyOrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const token = getUserToken();

    if (!token) {
      navigate(`/login?redirect=/my-orders/${id}`);
      return;
    }

    api
      .get(`/my-orders/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((res) => {
        setOrder(res.data.order);
        setItems(Array.isArray(res.data.items) ? res.data.items : []);
      })
      .catch((err) => {
        // Session expired: sign in again and come back to this order
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          clearUserSession();
          navigate(`/login?redirect=/my-orders/${id}`);
          return;
        }
        console.error(err);
        setErrorMsg(
          err?.response?.status === 404
            ? "We couldn't find this order."
            : "We couldn't load this order. Please try again."
        );
      });
  }, [id, navigate]);

  const backLink = (
    <Link to="/my-orders" className="mt-back">
      <ArrowBackIcon fontSize="small" /> All orders
    </Link>
  );

  if (errorMsg) {
    return (
      <section className="mt-page">
        <div className="mt-container">
          {backLink}
          <div className="mt-alert mt-alert--error" role="alert">
            {errorMsg}
          </div>
        </div>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="mt-page">
        <div className="mt-container">
          {backLink}
          <div className="mt-skeleton mo-skeleton-head" />
          <div className="mt-skeleton mo-skeleton-block" />
        </div>
      </section>
    );
  }

  const status = orderStatus(order.status);
  const placed = formatOrderDate(order.created_at);
  const stepIndex = STEPS.findIndex((s) => s.key === status.key);
  const itemCount = items.reduce((sum, it) => sum + Number(it.quantity || 1), 0);

  return (
    <section className="mt-page">
      <div className="mt-container">
        {backLink}

        <header className="mt-head mod-head">
          <div>
            <h1 className="mt-title">Order #{order.id}</h1>
            <p className="mt-lead">
              Placed on {placed.date}
              {placed.time && ` at ${placed.time}`}
            </p>
          </div>
          <span className={`mt-badge mt-badge--${status.key} mod-badge`}>{status.label}</span>
        </header>

        {/* ===== Progress ===== */}
        {status.key === "cancelled" ? (
          <div className="mt-alert mt-alert--error">
            This order was cancelled. If you have questions, please{" "}
            <Link to="/contact" className="mt-link">
              contact us
            </Link>
            .
          </div>
        ) : stepIndex >= 0 ? (
          <ol className="mod-steps mt-panel" aria-label="Order progress">
            {STEPS.map((step, i) => (
              <li
                key={step.key}
                className={i < stepIndex ? "is-done" : i === stepIndex ? "is-current" : ""}
                aria-current={i === stepIndex ? "step" : undefined}
              >
                <span className="mod-steps__dot">{i <= stepIndex ? <CheckIcon /> : i + 1}</span>
                <span className="mod-steps__label">{step.label}</span>
              </li>
            ))}
          </ol>
        ) : null}

        <div className="mod-grid">
          {/* ===== Items ===== */}
          <div className="mt-panel mod-items">
            <div className="mod-panel-head">
              <h2>Items</h2>
              <span>
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </span>
            </div>

            <ul className="mod-lines">
              {items.map((item, index) => {
                const price = Number(item.price || 0);
                const qty = Number(item.quantity || 1);

                return (
                  <li key={index}>
                    <img
                      className="mod-thumb"
                      src={imageUrl(item.product_image) || FALLBACK_IMG}
                      alt=""
                      loading="lazy"
                      onError={onImageError}
                    />
                    <div className="mod-lines__info">
                      <strong>{item.product_name}</strong>
                      <small>
                        {formatMoney(price)} × {qty}
                      </small>
                    </div>
                    <span>{formatMoney(price * qty)}</span>
                  </li>
                );
              })}
            </ul>

            {Number(order.delivery_fee) > 0 && (
              <div className="mod-subline">
                <span>Delivery</span>
                <span>{formatMoney(order.delivery_fee)}</span>
              </div>
            )}
            <div className="mod-total">
              <span>Total</span>
              <strong>{formatMoney(order.total)}</strong>
            </div>
          </div>

          {/* ===== Delivery ===== */}
          <aside className="mt-panel mod-delivery">
            <div className="mod-panel-head">
              <h2>Delivery details</h2>
            </div>

            <ul className="mod-contact">
              <li>
                <PersonOutlineIcon fontSize="small" />
                <span>{order.customer_name}</span>
              </li>
              <li>
                <PhoneOutlinedIcon fontSize="small" />
                <span>{order.customer_phone}</span>
              </li>
              <li>
                <PlaceOutlinedIcon fontSize="small" />
                <span>{order.customer_address}</span>
              </li>
              {paymentLabel(order.payment_method) && (
                <li>
                  <PaymentsOutlinedIcon fontSize="small" />
                  <span>{paymentLabel(order.payment_method)}</span>
                </li>
              )}
            </ul>

            <p className="mod-help">
              Need to change something? <Link to="/contact" className="mt-link">Contact us</Link>
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}

export default MyOrderDetails;
