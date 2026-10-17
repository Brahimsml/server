import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import AddIcon from "@mui/icons-material/Add";
import api from "../api";
import { PageHeader, StatusBreakdown, messageStatus, messageBadge } from "../Components/admin/AdminUI";
import { formatMoney, formatOrderDate, orderStatus } from "../utils/shop";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get("/admin/stats")
      .then((res) => setData(res.data))
      .catch((err) => {
        console.error(err);
        setError("We couldn't load the dashboard. Please refresh the page.");
      });
  }, []);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const header = (
    <PageHeader
      title={greeting()}
      subtitle={`Here's what's happening in your store · ${today}`}
      actions={
        <Link to="/products/add" className="mt-btn mt-btn--primary">
          <AddIcon /> Add product
        </Link>
      }
    />
  );

  if (error) {
    return (
      <>
        {header}
        <div className="mt-alert mt-alert--error">{error}</div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        {header}
        <div className="ad-kpis">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="mt-skeleton" style={{ height: 128 }} />
          ))}
        </div>
        <div className="mt-skeleton" style={{ height: 320 }} />
      </>
    );
  }

  const s = data.stats || {};
  const recentOrders = data.recentOrders || [];
  const recentMessages = data.recentMessages || [];
  const openOrders = Number(s.pendingOrders || 0) + Number(s.processingOrders || 0);

  const kpis = [
    {
      label: "Revenue",
      value: formatMoney(s.totalRevenue),
      sub: "From completed orders",
      icon: PaymentsOutlinedIcon,
      to: "/orders/admin",
      accent: true,
    },
    {
      label: "Orders",
      value: s.totalOrders || 0,
      sub: openOrders ? `${openOrders} need attention` : "All caught up",
      icon: ReceiptLongOutlinedIcon,
      to: "/orders/admin",
    },
    {
      label: "Products",
      value: s.totalProducts || 0,
      sub: "In the catalog",
      icon: Inventory2OutlinedIcon,
      to: "/products/admin",
    },
    {
      label: "Messages",
      value: s.totalMessages || 0,
      sub: s.newMessages ? `${s.newMessages} unread` : "No unread messages",
      icon: MailOutlineIcon,
      to: "/contacts/admin",
    },
    {
      label: "Stores",
      value: s.totalPlaces || 0,
      sub: "Store locations",
      icon: StorefrontOutlinedIcon,
      to: "/places/admin",
    },
  ];

  return (
    <>
      {header}

      {/* ===== KPIs ===== */}
      <div className="ad-kpis">
        {kpis.map(({ label, value, sub, icon: Icon, to, accent }) => (
          <Link key={label} to={to} className={`ad-kpi mt-panel ${accent ? "ad-kpi--accent" : ""}`}>
            <div className="ad-kpi__top">
              {label}
              <span className="ad-kpi__icon">
                <Icon fontSize="small" />
              </span>
            </div>
            <span className="ad-kpi__value">{value}</span>
            <span className="ad-kpi__sub">{sub}</span>
          </Link>
        ))}
      </div>

      {/* ===== Status breakdowns ===== */}
      <div className="ad-grid-2">
        <section className="mt-panel">
          <div className="ad-panel-head">
            <div>
              <h2>Orders by status</h2>
              <p>{s.totalOrders || 0} orders in total</p>
            </div>
            <Link to="/orders/admin" className="mt-link">
              Manage
            </Link>
          </div>
          <div className="ad-panel-body">
            <StatusBreakdown
              items={[
                { key: "pending", label: "Pending", count: Number(s.pendingOrders || 0) },
                { key: "processing", label: "Processing", count: Number(s.processingOrders || 0) },
                { key: "done", label: "Completed", count: Number(s.completedOrders || 0) },
                { key: "cancelled", label: "Cancelled", count: Number(s.cancelledOrders || 0) },
              ]}
            />
          </div>
        </section>

        <section className="mt-panel">
          <div className="ad-panel-head">
            <div>
              <h2>Customer messages</h2>
              <p>{s.totalMessages || 0} messages in total</p>
            </div>
            <Link to="/contacts/admin" className="mt-link">
              Open inbox
            </Link>
          </div>
          <div className="ad-panel-body">
            <StatusBreakdown
              items={[
                { key: "new", label: "New", count: Number(s.newMessages || 0) },
                { key: "read", label: "Read", count: Number(s.readMessages || 0) },
                { key: "done", label: "Done", count: Number(s.doneMessages || 0) },
              ]}
            />
          </div>
        </section>
      </div>

      {/* ===== Recent activity ===== */}
      <div className="ad-grid-main">
        <section className="mt-panel">
          <div className="ad-panel-head">
            <div>
              <h2>Recent orders</h2>
              <p>The latest checkouts</p>
            </div>
            <Link to="/orders/admin" className="mt-link">
              View all
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="mt-empty">
              <h3>No orders yet</h3>
              <p>New orders will show up here.</p>
            </div>
          ) : (
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th className="ad-num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => {
                    const st = orderStatus(o.status);
                    const { date } = formatOrderDate(o.created_at);
                    return (
                      <tr key={o.id} className="is-link" onClick={() => navigate(`/orders/${o.id}`)}>
                        <td data-label="Order">
                          <span className="ad-strong">#{o.id}</span>
                          <small>{date}</small>
                        </td>
                        <td data-label="Customer">{o.customer_name}</td>
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

        <section className="mt-panel">
          <div className="ad-panel-head">
            <div>
              <h2>Latest messages</h2>
              <p>From the contact form</p>
            </div>
            <Link to="/contacts/admin" className="mt-link">
              View all
            </Link>
          </div>

          {recentMessages.length === 0 ? (
            <div className="mt-empty">
              <h3>No messages yet</h3>
              <p>Messages from the contact page will show up here.</p>
            </div>
          ) : (
            <ul className="ad-inbox">
              {recentMessages.map((m) => {
                const st = messageStatus(m.status);
                return (
                  <li key={m.id} className={`ad-msg ${st.key === "new" ? "is-new" : ""}`}>
                    <Link to="/contacts/admin" className="ad-msg__row" style={{ textDecoration: "none" }}>
                      <span className="ad-msg__dot" />
                      <div style={{ minWidth: 0 }}>
                        <div className="ad-msg__who">
                          <strong>{m.full_name}</strong>
                        </div>
                        <p className="ad-msg__preview">{m.email}</p>
                      </div>
                      <div className="ad-msg__side">
                        <span className={`mt-badge mt-badge--${messageBadge[st.key] || "neutral"}`}>
                          {st.label}
                        </span>
                        {formatOrderDate(m.created_at).date}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

export default AdminDashboard;
