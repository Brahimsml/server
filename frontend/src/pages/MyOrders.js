import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import SearchIcon from "@mui/icons-material/Search";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import api from "../api";
import { formatMoney, formatOrderDate, orderStatus, ORDER_STATUS_OPTIONS } from "../utils/shop";
import "../Styles/theme.css";
import "../Styles/Orders.css";

const DEFAULT_FILTERS = { search: "", status: "all", date: "all", sort: "newest" };
const PAGE_SIZE = 10;

function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Start from the first 10 again whenever the filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters]);

  const navigate = useNavigate();

  // Set by the cart right after a successful checkout
  const placedOrderId = useLocation().state?.placedOrderId;

  const loadOrders = useCallback(() => {
    const token = sessionStorage.getItem("userToken");

    if (!token) {
      navigate("/login?redirect=/my-orders");
      return;
    }

    setErrorMsg("");
    setLoading(true);

    api
      .get(`/my-orders?t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((res) => {
        setOrders(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        // Session expired: sign in again and come back here
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          sessionStorage.removeItem("userToken");
          sessionStorage.removeItem("user");
          navigate("/login?redirect=/my-orders");
          return;
        }
        console.error(err);
        setErrorMsg("We couldn't load your orders. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const setFilter = (name, value) => setFilters((prev) => ({ ...prev, [name]: value }));
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  const orderTime = (order) => {
    const t = new Date(order.created_at).getTime();
    return Number.isNaN(t) ? 0 : t;
  };

  const filteredOrders = useMemo(() => {
    const q = filters.search.trim().toLowerCase().replace(/^#/, "");
    const now = new Date();

    const inDateRange = (order) => {
      if (filters.date === "all") return true;
      const t = orderTime(order);
      if (!t) return false;
      const d = new Date(t);

      if (filters.date === "30days") return now - d <= 30 * 24 * 60 * 60 * 1000;
      if (filters.date === "6months") return now - d <= 183 * 24 * 60 * 60 * 1000;
      if (filters.date === "year") return d.getFullYear() === now.getFullYear();
      return true;
    };

    return orders
      .filter((order) => {
        const status = orderStatus(order.status);
        if (filters.status !== "all" && status.key !== filters.status) return false;
        if (!inDateRange(order)) return false;
        if (!q) return true;

        const { date } = formatOrderDate(order.created_at);
        const text = `${order.id} ${status.key} ${status.label} ${date} ${Number(order.total || 0).toFixed(2)}`;
        return text.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (filters.sort === "oldest") return orderTime(a) - orderTime(b);
        if (filters.sort === "total-high") return Number(b.total || 0) - Number(a.total || 0);
        if (filters.sort === "total-low") return Number(a.total || 0) - Number(b.total || 0);
        return orderTime(b) - orderTime(a);
      });
  }, [orders, filters]);

  const stats = useMemo(() => {
    const keys = orders.map((o) => orderStatus(o.status).key);
    return {
      total: orders.length,
      active: keys.filter((k) => k === "pending" || k === "processing").length,
      completed: keys.filter((k) => k === "done").length,
    };
  }, [orders]);

  const openOrder = (id) => navigate(`/my-orders/${id}`);

  return (
    <section className="mt-page">
      <div className="mt-container">
        <header className="mt-head">
          <div>
            <span className="mt-eyebrow">My account</span>
            <h1 className="mt-title">My orders</h1>
            <p className="mt-lead">Track your orders and see what you've bought.</p>
          </div>
          <Link to="/shop" className="mt-btn mt-btn--secondary">
            Continue shopping
          </Link>
        </header>

        {placedOrderId && (
          <div className="mt-alert mt-alert--success" role="status">
            Thank you! Your order #{placedOrderId} has been placed. A confirmation email is on its
            way.
          </div>
        )}

        {errorMsg && (
          <div className="mt-alert mt-alert--error" role="alert">
            {errorMsg}{" "}
            <button type="button" className="mt-link" onClick={loadOrders}>
              Retry
            </button>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div className="mo-stats">
            <div className="mo-stat mt-panel">
              <span>Total orders</span>
              <strong>{stats.total}</strong>
            </div>
            <div className="mo-stat mt-panel">
              <span>In progress</span>
              <strong>{stats.active}</strong>
            </div>
            <div className="mo-stat mt-panel">
              <span>Completed</span>
              <strong>{stats.completed}</strong>
            </div>
          </div>
        )}

        <div className="mt-panel mo-panel">
          {loading ? (
            <div className="mo-loading">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="mt-skeleton mo-skeleton-row" />
              ))}
            </div>
          ) : orders.length === 0 && !errorMsg ? (
            <div className="mt-empty">
              <div className="mt-empty__icon">
                <ReceiptLongOutlinedIcon fontSize="inherit" />
              </div>
              <h3>No orders yet</h3>
              <p>When you place an order, it will show up here so you can track it.</p>
              <Link to="/shop" className="mt-btn mt-btn--primary">
                Start shopping
              </Link>
            </div>
          ) : (
            <>
              <div className="mo-toolbar">
                <label className="mo-search">
                  <SearchIcon fontSize="small" />
                  <input
                    type="search"
                    value={filters.search}
                    placeholder="Search by order number, status or date"
                    onChange={(e) => setFilter("search", e.target.value)}
                    aria-label="Search orders"
                  />
                </label>

                <select
                  className="mt-input"
                  value={filters.status}
                  onChange={(e) => setFilter("status", e.target.value)}
                  aria-label="Filter by status"
                >
                  <option value="all">All statuses</option>
                  {ORDER_STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>

                <select
                  className="mt-input"
                  value={filters.date}
                  onChange={(e) => setFilter("date", e.target.value)}
                  aria-label="Filter by date"
                >
                  <option value="all">All time</option>
                  <option value="30days">Last 30 days</option>
                  <option value="6months">Last 6 months</option>
                  <option value="year">This year</option>
                </select>

                <select
                  className="mt-input"
                  value={filters.sort}
                  onChange={(e) => setFilter("sort", e.target.value)}
                  aria-label="Sort orders"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="total-high">Total: high to low</option>
                  <option value="total-low">Total: low to high</option>
                </select>
              </div>

              <div className="mo-meta">
                <span>
                  Showing {filteredOrders.length} of {orders.length}{" "}
                  {orders.length === 1 ? "order" : "orders"}
                </span>
                {filtersActive && (
                  <button type="button" className="mt-link" onClick={() => setFilters(DEFAULT_FILTERS)}>
                    Clear filters
                  </button>
                )}
              </div>

              {filteredOrders.length === 0 ? (
                <div className="mt-empty">
                  <h3>No orders match your filters</h3>
                  <p>Try a different search, status or date range.</p>
                  <button
                    type="button"
                    className="mt-btn mt-btn--secondary"
                    onClick={() => setFilters(DEFAULT_FILTERS)}
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <table className="mo-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Placed on</th>
                      <th>Status</th>
                      <th className="mo-num">Total</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.slice(0, visibleCount).map((order) => {
                      const status = orderStatus(order.status);
                      const { date, time } = formatOrderDate(order.created_at);

                      return (
                        <tr key={order.id} onClick={() => openOrder(order.id)}>
                          <td data-label="Order">
                            <strong>#{order.id}</strong>
                          </td>
                          <td data-label="Placed on">
                            <span>
                              {date}
                              {time && <small>{time}</small>}
                            </span>
                          </td>
                          <td data-label="Status">
                            <span className={`mt-badge mt-badge--${status.key}`}>{status.label}</span>
                          </td>
                          <td data-label="Total" className="mo-num">
                            <strong>{formatMoney(order.total)}</strong>
                          </td>
                          <td className="mo-action">
                            <Link
                              to={`/my-orders/${order.id}`}
                              className="mt-btn mt-btn--ghost mt-btn--sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View <ChevronRightIcon />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {filteredOrders.length > visibleCount && (
                <div className="mo-more">
                  <button
                    type="button"
                    className="mt-btn mt-btn--secondary"
                    onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  >
                    Show more orders ({filteredOrders.length - visibleCount} more)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default MyOrders;
