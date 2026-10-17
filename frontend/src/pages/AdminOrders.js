import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import api from "../api";
import { useAdmin } from "../Components/admin/AdminLayout";
import { PageHeader, SearchBox, FilterTabs, apiError } from "../Components/admin/AdminUI";
import { OrderStatusSelect, useChangeOrderStatus } from "../Components/admin/OrderStatus";
import { formatMoney, formatOrderDate, orderStatus, ORDER_STATUS_OPTIONS } from "../utils/shop";

const PAGE_SIZE = 20;
const DAY = 24 * 60 * 60 * 1000;

function AdminOrders() {
  const { notify, confirm } = useAdmin();
  const changeStatus = useChangeOrderStatus();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const fetchOrders = () =>
    api
      .get("/orders")
      .then((res) => {
        setOrders(Array.isArray(res.data) ? res.data : []);
        setError("");
      })
      .catch((err) => {
        console.error(err);
        setError("We couldn't load orders. Please refresh the page.");
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [tab, search, dateFilter, sortBy]);

  const time = (o) => {
    const t = new Date(o.created_at).getTime();
    return Number.isNaN(t) ? 0 : t;
  };

  const counts = useMemo(() => {
    const c = { all: orders.length };
    ORDER_STATUS_OPTIONS.forEach((s) => (c[s.value] = 0));
    orders.forEach((o) => {
      const k = orderStatus(o.status).key;
      c[k] = (c[k] || 0) + 1;
    });
    return c;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^#/, "");
    const now = Date.now();

    return orders
      .filter((o) => {
        if (tab !== "all" && orderStatus(o.status).key !== tab) return false;

        if (dateFilter !== "all") {
          const t = time(o);
          if (!t) return false;
          if (dateFilter === "today" && new Date(t).toDateString() !== new Date().toDateString()) return false;
          if (dateFilter === "7days" && now - t > 7 * DAY) return false;
          if (dateFilter === "30days" && now - t > 30 * DAY) return false;
          if (dateFilter === "year" && new Date(t).getFullYear() !== new Date().getFullYear()) return false;
        }

        if (!q) return true;
        return `${o.id} ${o.customer_name} ${o.user_email} ${o.customer_phone} ${o.customer_address}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        if (sortBy === "oldest") return time(a) - time(b);
        if (sortBy === "total-high") return Number(b.total) - Number(a.total);
        if (sortBy === "total-low") return Number(a.total) - Number(b.total);
        return time(b) - time(a);
      });
  }, [orders, tab, search, dateFilter, sortBy]);

  const handleStatus = async (order, next) => {
    if (await changeStatus(order, next)) {
      setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
    }
  };

  const handleDelete = async (order) => {
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
      setOrders((list) => list.filter((o) => o.id !== order.id));
      notify(`Order #${order.id} was deleted`);
    } catch (err) {
      console.error(err);
      notify(apiError(err, "We couldn't delete this order."), "error");
    }
  };

  const filtersActive = search || dateFilter !== "all" || tab !== "all";

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle={
          loading
            ? "Loading orders…"
            : `${orders.length} orders · ${counts.pending || 0} pending · ${counts.processing || 0} processing`
        }
      />

      {error && <div className="mt-alert mt-alert--error">{error}</div>}

      <section className="mt-panel">
        <FilterTabs
          label="Order status"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "all", label: "All", count: counts.all },
            ...ORDER_STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label, count: counts[s.value] || 0 })),
          ]}
        />

        <div className="ad-toolbar">
          <SearchBox value={search} onChange={setSearch} placeholder="Search by order #, customer, email or phone" />
          <select className="mt-input" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} aria-label="Date">
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
            <option value="year">This year</option>
          </select>
          <select className="mt-input" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="total-high">Total: high to low</option>
            <option value="total-low">Total: low to high</option>
          </select>
        </div>

        {loading ? (
          <div className="ad-panel-body" style={{ display: "grid", gap: 10 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="mt-skeleton" style={{ height: 52, borderRadius: 10 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-empty">
            <div className="mt-empty__icon">
              <ReceiptLongOutlinedIcon fontSize="inherit" />
            </div>
            <h3>{orders.length === 0 ? "No orders yet" : "No orders match"}</h3>
            <p>{orders.length === 0 ? "Orders will appear here when customers check out." : "Try a different search, status or date."}</p>
            {filtersActive && orders.length > 0 && (
              <button
                type="button"
                className="mt-btn mt-btn--secondary"
                onClick={() => {
                  setTab("all");
                  setSearch("");
                  setDateFilter("all");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="ad-meta">
              Showing {Math.min(visible, filtered.length)} of {filtered.length}
              {filtered.length !== orders.length && ` (${orders.length} in total)`}
            </div>
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th className="ad-num">Total</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, visible).map((o) => {
                    const { date, time: t } = formatOrderDate(o.created_at);
                    return (
                      <tr key={o.id} className="is-link" onClick={() => navigate(`/orders/${o.id}`)}>
                        <td data-label="Order">
                          <span>
                            <span className="ad-strong">#{o.id}</span>
                            <small>
                              {date} · {t}
                            </small>
                          </span>
                        </td>
                        <td data-label="Customer">
                          <span>
                            {o.customer_name}
                            <small>{o.user_email}</small>
                          </span>
                        </td>
                        <td data-label="Status">
                          <OrderStatusSelect order={o} onChange={(next) => handleStatus(o, next)} />
                        </td>
                        <td data-label="Total" className="ad-num ad-strong">
                          {formatMoney(o.total)}
                        </td>
                        <td className="ad-actions-cell" onClick={(e) => e.stopPropagation()}>
                          <div className="ad-row-actions">
                            <button
                              type="button"
                              className="ad-icon-btn ad-icon-btn--danger"
                              onClick={() => handleDelete(o)}
                              aria-label={`Delete order #${o.id}`}
                              title="Delete"
                            >
                              <DeleteOutlineIcon />
                            </button>
                            <Link to={`/orders/${o.id}`} className="ad-icon-btn" aria-label={`Open order #${o.id}`} title="Open">
                              <ChevronRightIcon />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filtered.length > visible && (
              <div className="ad-more">
                <button type="button" className="mt-btn mt-btn--secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                  Show more ({filtered.length - visible} more)
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}

export default AdminOrders;
