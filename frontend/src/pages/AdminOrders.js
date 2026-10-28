import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import api from "../api";
import { useAdmin } from "../Components/admin/AdminLayout";
import { PageHeader, SearchBox, FilterTabs } from "../Components/admin/AdminUI";
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
  const [selected, setSelected] = useState(() => new Set()); // order ids ticked for a bulk change
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

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

  // ===== Bulk status change (tick orders, pick a status, Apply) =====
  // Cancelled orders can't change, so they can't be ticked
  const canSelect = (o) => orderStatus(o.status).key !== "cancelled";
  const shown = filtered.slice(0, visible);
  const selectable = shown.filter(canSelect);
  const allTicked = selectable.length > 0 && selectable.every((o) => selected.has(o.id));

  // A new filter or search starts a fresh selection
  useEffect(() => setSelected(new Set()), [tab, search, dateFilter]);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () => setSelected(allTicked ? new Set() : new Set(selectable.map((o) => o.id)));

  const applyBulk = async () => {
    const targets = orders.filter((o) => selected.has(o.id) && orderStatus(o.status).key !== bulkStatus);
    if (!bulkStatus || !targets.length) {
      notify("Those orders already have that status.", "error");
      return;
    }
    const label = orderStatus(bulkStatus).label.toLowerCase();
    const cancelling = bulkStatus === "cancelled";
    const ok = await confirm({
      title: `Mark ${targets.length} ${targets.length === 1 ? "order" : "orders"} as ${label}?`,
      message: cancelling
        ? "Their items go back into stock, each customer gets an email, and cancelled orders can't be reopened."
        : "Each customer gets an email about the new status.",
      confirmLabel: cancelling ? "Cancel orders" : `Mark as ${label}`,
      cancelLabel: "Go back",
      danger: cancelling,
    });
    if (!ok) return;

    setBulkBusy(true);
    const done = [];
    for (const o of targets) {
      try {
        await api.put(`/orders/${o.id}/status`, { status: bulkStatus });
        done.push(o.id);
      } catch (err) {
        console.error(err);
      }
    }
    setOrders((list) => list.map((o) => (done.includes(o.id) ? { ...o, status: bulkStatus } : o)));
    setSelected(new Set());
    setBulkStatus("");
    setBulkBusy(false);
    const failed = targets.length - done.length;
    notify(
      failed
        ? `${done.length} updated, ${failed} couldn't be changed. Please check them.`
        : `${done.length} ${done.length === 1 ? "order is" : "orders are"} now ${label}. Customers were emailed.`,
      failed ? "error" : "success"
    );
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
            {selected.size > 0 ? (
              <div className="ad-bulk" role="region" aria-label="Change several orders">
                <strong>
                  {selected.size} {selected.size === 1 ? "order" : "orders"} selected
                </strong>
                <select
                  className="mt-input"
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  aria-label="New status for the selected orders"
                >
                  <option value="">Change status to…</option>
                  {ORDER_STATUS_OPTIONS.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
                <button type="button" className="mt-btn mt-btn--primary mt-btn--sm" onClick={applyBulk} disabled={!bulkStatus || bulkBusy}>
                  {bulkBusy ? "Updating…" : "Apply"}
                </button>
                <button type="button" className="mt-link" onClick={() => setSelected(new Set())} disabled={bulkBusy}>
                  Clear
                </button>
              </div>
            ) : (
              <div className="ad-meta">
                Showing {Math.min(visible, filtered.length)} of {filtered.length}
                {filtered.length !== orders.length && ` (${orders.length} in total)`}
              </div>
            )}
            <div className="ad-table-wrap">
              <table className="ad-table ad-orders">
                <thead>
                  <tr>
                    <th className="ad-check-cell">
                      <input
                        type="checkbox"
                        className="ad-check"
                        checked={allTicked}
                        onChange={toggleAll}
                        disabled={!selectable.length}
                        aria-label="Select all orders shown"
                      />
                    </th>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th className="ad-num">Total</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((o) => {
                    const { date, time: t } = formatOrderDate(o.created_at);
                    const ticked = selected.has(o.id);
                    return (
                      <tr
                        key={o.id}
                        className={`is-link ${ticked ? "is-selected" : ""}`}
                        onClick={() => navigate(`/orders/${o.id}`)}
                      >
                        <td className="ad-check-cell" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="ad-check"
                            checked={ticked}
                            onChange={() => toggle(o.id)}
                            disabled={!canSelect(o)}
                            aria-label={`Select order #${o.id}`}
                            title={canSelect(o) ? "Select" : "Cancelled orders can't be changed"}
                          />
                        </td>
                        <td data-label="Order" className="ad-orders__id">
                          <span>
                            <span className="ad-strong">#{o.id}</span>
                            <small>
                              {date} · {t}
                            </small>
                          </span>
                        </td>
                        <td data-label="Customer" className="ad-orders__customer">
                          <span>
                            {o.customer_name}
                            <small>{o.user_email}</small>
                          </span>
                        </td>
                        <td data-label="Status" className="ad-orders__status">
                          <OrderStatusSelect order={o} onChange={(next) => handleStatus(o, next)} />
                        </td>
                        <td data-label="Total" className="ad-num ad-strong ad-orders__total">
                          {formatMoney(o.total)}
                        </td>
                        <td className="ad-actions-cell ad-orders__open" onClick={(e) => e.stopPropagation()}>
                          <div className="ad-row-actions">
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
