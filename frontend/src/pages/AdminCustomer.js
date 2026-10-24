import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import CallOutlinedIcon from "@mui/icons-material/CallOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import api from "../api";
import { PageHeader } from "../Components/admin/AdminUI";
import {
  formatMoney,
  formatOrderDate,
  imageUrl,
  onImageError,
  orderStatus,
  telLink,
  whatsappLink,
  FALLBACK_IMG,
} from "../utils/shop";

const monthYear = (value) =>
  value ? new Date(value).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "";

// One customer: details, contact buttons, spending, orders and favourite products
function AdminCustomer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/admin/customers/${id}`)
      .then((res) => {
        setData(res.data);
        document.title = `${res.data.customer.name} | MegaTech Admin`;
      })
      .catch((err) =>
        setError(err.response?.status === 404 ? "This customer doesn't exist." : "We couldn't load this customer.")
      );
  }, [id]);

  const back = { to: "/customers/admin", label: "Customers" };

  if (error) {
    return (
      <>
        <PageHeader back={back} title="Customer" />
        <div className="mt-alert mt-alert--error">{error}</div>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <PageHeader back={back} title="Customer" subtitle="Loading…" />
        <div className="mt-skeleton" style={{ height: 360 }} />
      </>
    );
  }

  const { customer: c, stats, orders, topProducts } = data;
  const firstName = String(c.name || "").trim().split(/\s+/)[0];
  const wa = whatsappLink(c.phone, `Hi ${firstName}, this is MegaTech.`);
  const tel = telLink(c.phone);

  const kpis = [
    { label: "Orders", value: stats.orders, sub: stats.cancelled ? `+ ${stats.cancelled} cancelled` : "Not counting cancelled" },
    { label: "Total spent", value: formatMoney(stats.spent), sub: "Delivery included", accent: true },
    { label: "Average order", value: formatMoney(stats.average), sub: stats.orders ? "Per order" : "No orders yet" },
    {
      label: "Last order",
      value: stats.last_order_at ? formatOrderDate(stats.last_order_at).date : "—",
      sub: stats.first_order_at ? `First order ${formatOrderDate(stats.first_order_at).date}` : "Hasn't ordered yet",
    },
  ];

  return (
    <>
      <PageHeader
        back={back}
        title={c.name}
        subtitle={`Customer since ${monthYear(c.created_at)}`}
        actions={
          <>
            {wa && (
              <a className="mt-btn mt-btn--sm ad-btn-whatsapp" href={wa} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon /> WhatsApp
              </a>
            )}
            {tel && (
              <a className="mt-btn mt-btn--secondary mt-btn--sm" href={tel}>
                <CallOutlinedIcon /> Call
              </a>
            )}
            <a className="mt-btn mt-btn--secondary mt-btn--sm" href={`mailto:${c.email}`}>
              <MailOutlineIcon /> Email
            </a>
          </>
        }
      />

      <div className="ad-kpis ad-kpis--compact">
        {kpis.map((k) => (
          <div key={k.label} className={`ad-kpi mt-panel ${k.accent ? "ad-kpi--accent" : ""}`}>
            <div className="ad-kpi__top">{k.label}</div>
            <span className="ad-kpi__value">{k.value}</span>
            <span className="ad-kpi__sub">{k.sub}</span>
          </div>
        ))}
      </div>

      <div className="ad-grid-main">
        <section className="mt-panel">
          <div className="ad-panel-head">
            <div>
              <h2>Orders</h2>
              <p>
                {orders.length} {orders.length === 1 ? "order" : "orders"} in total
              </p>
            </div>
          </div>
          {orders.length === 0 ? (
            <div className="mt-empty">
              <div className="mt-empty__icon">
                <ReceiptLongOutlinedIcon fontSize="inherit" />
              </div>
              <h3>No orders yet</h3>
              <p>This customer has an account but hasn't ordered.</p>
            </div>
          ) : (
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Items</th>
                    <th>Status</th>
                    <th className="ad-num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const st = orderStatus(o.status);
                    const { date } = formatOrderDate(o.created_at);
                    return (
                      <tr key={o.id} className="is-link" onClick={() => navigate(`/orders/${o.id}`)}>
                        <td data-label="Order">
                          <span>
                            <span className="ad-strong">#{o.id}</span>
                            <small>{date}</small>
                          </span>
                        </td>
                        <td data-label="Items">{o.items}</td>
                        <td data-label="Status">
                          <span className={`mt-badge mt-badge--${st.key}`}>{st.label}</span>
                        </td>
                        <td data-label="Total" className="ad-num ad-strong">
                          {formatMoney(o.total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="ad-stack">
          <section className="mt-panel">
            <div className="ad-panel-head">
              <h2>Details</h2>
            </div>
            <ul className="ad-info">
              <li>
                <MailOutlineIcon /> <a href={`mailto:${c.email}`}>{c.email}</a>
              </li>
              <li>
                <PhoneOutlinedIcon /> {c.phone || <span className="ad-muted">No phone yet</span>}
              </li>
              <li>
                <PlaceOutlinedIcon /> {c.address || <span className="ad-muted">No address yet</span>}
              </li>
              <li>
                <VerifiedOutlinedIcon />
                {c.google_linked ? "Signs in with Google" : c.email_verified ? "Email confirmed" : "Email not confirmed"}
              </li>
              <li>
                <FavoriteBorderIcon /> {stats.wishlist} {stats.wishlist === 1 ? "product" : "products"} in their wishlist
              </li>
            </ul>
            <p className="ad-note">Phone and address come from their account, or their latest order.</p>
          </section>

          <section className="mt-panel">
            <div className="ad-panel-head">
              <h2>Favourite products</h2>
            </div>
            {topProducts.length === 0 ? (
              <p className="ad-empty-line">Nothing bought yet.</p>
            ) : (
              <ul className="ad-rank">
                {topProducts.map((p) => (
                  <li key={p.id}>
                    <img className="ad-thumb" src={imageUrl(p.image) || FALLBACK_IMG} alt="" onError={onImageError} />
                    <div>
                      <strong>{p.name}</strong>
                      <small>
                        {p.qty} bought · {formatMoney(p.spent)}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

export default AdminCustomer;
