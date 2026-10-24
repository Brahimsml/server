import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import CallOutlinedIcon from "@mui/icons-material/CallOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import api from "../api";
import { useAdmin } from "../Components/admin/AdminLayout";
import { PageHeader, apiError } from "../Components/admin/AdminUI";
import { OrderStatusSelect, useChangeOrderStatus } from "../Components/admin/OrderStatus";
import {
  formatMoney,
  formatOrderDate,
  imageUrl,
  onImageError,
  orderStatus,
  paymentLabel,
  telLink,
  whatsappLink,
  FALLBACK_IMG,
} from "../utils/shop";

function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify, confirm } = useAdmin();
  const changeStatus = useChangeOrderStatus();

  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/orders/${id}`)
      .then((res) => {
        setOrder(res.data.order);
        setItems(res.data.items || []);
      })
      .catch((err) => {
        console.error(err);
        setError(err?.response?.status === 404 ? "This order doesn't exist." : "We couldn't load this order.");
      });
  }, [id]);

  const back = { to: "/orders/admin", label: "Orders" };

  if (error) {
    return (
      <>
        <PageHeader back={back} title={`Order #${id}`} />
        <div className="mt-alert mt-alert--error">{error}</div>
      </>
    );
  }

  if (!order) {
    return (
      <>
        <PageHeader back={back} title={`Order #${id}`} subtitle="Loading…" />
        <div className="mt-skeleton" style={{ height: 360 }} />
      </>
    );
  }

  const placed = formatOrderDate(order.created_at);
  const itemCount = items.reduce((sum, it) => sum + Number(it.quantity || 1), 0);

  const handleStatus = async (next) => {
    if (await changeStatus(order, next)) setOrder((o) => ({ ...o, status: next }));
  };

  const handleDelete = async () => {
    const open = ["pending", "processing"].includes(orderStatus(order.status).key);
    const ok = await confirm({
      title: `Delete order #${order.id}?`,
      message: `The order will be removed permanently.${open ? " Its items go back into stock." : ""}`,
      confirmLabel: "Delete order",
      danger: true,
    });
    if (!ok) return;

    try {
      await api.delete(`/orders/${order.id}`);
      navigate("/orders/admin", { state: { notice: `Order #${order.id} was deleted` } });
    } catch (err) {
      console.error(err);
      notify(apiError(err, "We couldn't delete this order."), "error");
    }
  };

  return (
    <>
      <PageHeader
        back={back}
        title={`Order #${order.id}`}
        subtitle={`Placed on ${placed.date}${placed.time ? ` at ${placed.time}` : ""}`}
        actions={
          <>
            <OrderStatusSelect order={order} onChange={handleStatus} />
            <Link
              to={`/orders/${order.id}/invoice`}
              target="_blank"
              rel="noopener"
              className="mt-btn mt-btn--secondary mt-btn--sm"
            >
              <PrintOutlinedIcon /> Invoice
            </Link>
            <button type="button" className="mt-btn mt-btn--secondary mt-btn--sm" onClick={handleDelete}>
              <DeleteOutlineIcon /> Delete
            </button>
          </>
        }
      />

      <div className="ad-grid-main">
        <section className="mt-panel">
          <div className="ad-panel-head">
            <div>
              <h2>Items</h2>
              <p>
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </p>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="mt-empty">
              <p>No items were saved for this order.</p>
            </div>
          ) : (
            <ul className="ad-lines">
              {items.map((it, index) => {
                const price = Number(it.price || 0);
                const qty = Number(it.quantity || 1);
                return (
                  <li key={index}>
                    <img
                      className="ad-thumb"
                      src={imageUrl(it.product_image) || FALLBACK_IMG}
                      alt=""
                      onError={onImageError}
                    />
                    <div>
                      <strong>{it.product_name}</strong>
                      <small>
                        {formatMoney(price)} × {qty}
                      </small>
                    </div>
                    <span>{formatMoney(price * qty)}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {Number(order.delivery_fee) > 0 && (
            <div className="ad-subline">
              <span>Delivery</span>
              <span>{formatMoney(order.delivery_fee)}</span>
            </div>
          )}
          <div className="ad-total">
            <span>Total</span>
            <strong>{formatMoney(order.total)}</strong>
          </div>
        </section>

        <section className="mt-panel">
          <div className="ad-panel-head">
            <h2>Customer</h2>
          </div>
          <ul className="ad-info">
            <li>
              <PersonOutlineIcon /> {order.customer_name}
            </li>
            {order.user_email && (
              <li>
                <MailOutlineIcon /> <a href={`mailto:${order.user_email}`}>{order.user_email}</a>
              </li>
            )}
            <li>
              <PhoneOutlinedIcon /> <a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a>
            </li>
            <li>
              <PlaceOutlinedIcon /> {order.customer_address}
            </li>
            {paymentLabel(order.payment_method) && (
              <li>
                <PaymentsOutlinedIcon /> {paymentLabel(order.payment_method)}
              </li>
            )}
          </ul>
          {(whatsappLink(order.customer_phone) || telLink(order.customer_phone)) && (
            <div className="ad-contact-actions">
              {whatsappLink(order.customer_phone) && (
                <a
                  className="mt-btn mt-btn--sm ad-btn-whatsapp"
                  href={whatsappLink(
                    order.customer_phone,
                    `Hi ${String(order.customer_name || "").trim().split(/\s+/)[0]}, this is MegaTech about your order #${order.id} (${formatMoney(order.total)}).`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <WhatsAppIcon /> WhatsApp
                </a>
              )}
              {telLink(order.customer_phone) && (
                <a className="mt-btn mt-btn--secondary mt-btn--sm" href={telLink(order.customer_phone)}>
                  <CallOutlinedIcon /> Call
                </a>
              )}
            </div>
          )}
          <p className="ad-note">The customer gets an email every time you change the order status.</p>
        </section>
      </div>
    </>
  );
}

export default OrderDetails;
