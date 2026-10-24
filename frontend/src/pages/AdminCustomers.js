import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import api from "../api";
import { PageHeader, SearchBox, FilterTabs } from "../Components/admin/AdminUI";
import { formatMoney, formatOrderDate } from "../utils/shop";
import { downloadCsv } from "../utils/csv";

const PAGE_SIZE = 20;
const TOP_CUSTOMERS = 3; // "Top customer" badge for the biggest spenders

const shortDate = (value) => (value ? formatOrderDate(value).date : "");

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

function AdminCustomers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [sortBy, setSortBy] = useState("spent");
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    document.title = "Customers | MegaTech Admin";
    api
      .get("/admin/customers")
      .then((res) => setCustomers(Array.isArray(res.data) ? res.data : []))
      .catch(() => setError("We couldn't load your customers. Please refresh the page."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => setVisible(PAGE_SIZE), [search, tab, sortBy]);

  // Biggest spenders (who actually ordered) get a badge
  const topIds = useMemo(
    () =>
      new Set(
        [...customers]
          .filter((c) => c.total_spent > 0)
          .sort((a, b) => b.total_spent - a.total_spent)
          .slice(0, TOP_CUSTOMERS)
          .map((c) => c.id)
      ),
    [customers]
  );

  const stats = useMemo(() => {
    const ordered = customers.filter((c) => c.orders_count > 0);
    const returning = customers.filter((c) => c.orders_count >= 2);
    const spent = ordered.reduce((s, c) => s + c.total_spent, 0);
    const monthStart = startOfMonth();
    return {
      total: customers.length,
      ordered: ordered.length,
      returning: returning.length,
      none: customers.length - ordered.length,
      newThisMonth: customers.filter((c) => new Date(c.created_at) >= monthStart).length,
      averageSpend: ordered.length ? spent / ordered.length : 0,
    };
  }, [customers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    const list = customers.filter((c) => {
      if (tab === "ordered" && c.orders_count === 0) return false;
      if (tab === "returning" && c.orders_count < 2) return false;
      if (tab === "none" && c.orders_count > 0) return false;
      if (!q) return true;
      const text = `${c.name} ${c.email}`.toLowerCase();
      const phone = String(c.phone || "").replace(/\D/g, "");
      return text.includes(q) || (digits.length >= 3 && phone.includes(digits));
    });
    const time = (v) => (v ? new Date(v).getTime() : 0);
    const sorters = {
      spent: (a, b) => b.total_spent - a.total_spent,
      orders: (a, b) => b.orders_count - a.orders_count || b.total_spent - a.total_spent,
      recent: (a, b) => time(b.last_order_at) - time(a.last_order_at),
      newest: (a, b) => time(b.created_at) - time(a.created_at),
      name: (a, b) => String(a.name).localeCompare(String(b.name)),
    };
    return list.sort(sorters[sortBy]);
  }, [customers, search, tab, sortBy]);

  const exportCsv = () => {
    downloadCsv(
      `megatech-customers-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Name", "Email", "Phone", "Orders", "Total spent (USD)", "Open orders", "Last order", "Customer since", "Google sign-in"],
      filtered.map((c) => [
        c.name,
        c.email,
        c.phone || "",
        c.orders_count,
        c.total_spent.toFixed(2),
        c.open_orders,
        shortDate(c.last_order_at),
        shortDate(c.created_at),
        c.google_linked ? "Yes" : "No",
      ])
    );
  };

  const kpis = [
    { label: "Customers", value: stats.total, sub: `${stats.newThisMonth} new this month` },
    { label: "Have ordered", value: stats.ordered, sub: `${stats.none} not yet` },
    {
      label: "Returning",
      value: stats.returning,
      sub: stats.ordered ? `${Math.round((stats.returning / stats.ordered) * 100)}% ordered more than once` : "No orders yet",
    },
    { label: "Average spend", value: formatMoney(stats.averageSpend), sub: "Per customer who ordered" },
  ];

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={loading ? "Loading customers…" : `${stats.total} customers · ${stats.ordered} have ordered`}
        actions={
          <button type="button" className="mt-btn mt-btn--secondary" onClick={exportCsv} disabled={loading || !filtered.length}>
            <FileDownloadOutlinedIcon /> Export to Excel
          </button>
        }
      />

      {error && <div className="mt-alert mt-alert--error">{error}</div>}

      {!loading && !error && (
        <div className="ad-kpis ad-kpis--compact">
          {kpis.map((k) => (
            <div key={k.label} className="ad-kpi mt-panel">
              <div className="ad-kpi__top">{k.label}</div>
              <span className="ad-kpi__value">{k.value}</span>
              <span className="ad-kpi__sub">{k.sub}</span>
            </div>
          ))}
        </div>
      )}

      <section className="mt-panel">
        <FilterTabs
          label="Customers"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "all", label: "All", count: stats.total },
            { value: "ordered", label: "Have ordered", count: stats.ordered },
            { value: "returning", label: "Returning", count: stats.returning },
            { value: "none", label: "No orders yet", count: stats.none },
          ]}
        />

        <div className="ad-toolbar">
          <SearchBox value={search} onChange={setSearch} placeholder="Search by name, email or phone" />
          <select className="mt-input" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort">
            <option value="spent">Top spenders</option>
            <option value="orders">Most orders</option>
            <option value="recent">Ordered most recently</option>
            <option value="newest">Newest customers</option>
            <option value="name">Name A–Z</option>
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
              <PeopleOutlineIcon fontSize="inherit" />
            </div>
            <h3>No customers match</h3>
            <p>Try another search or tab.</p>
          </div>
        ) : (
          <>
            <div className="ad-meta">
              Showing {Math.min(visible, filtered.length)} of {filtered.length}
            </div>
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th className="ad-num">Orders</th>
                    <th className="ad-num">Total spent</th>
                    <th>Last order</th>
                    <th>Customer since</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, visible).map((c) => (
                    <tr key={c.id} className="is-link" onClick={() => navigate(`/customers/${c.id}`)}>
                      <td data-label="Customer">
                        <span className="ad-cust">
                          <span className="ad-cust__avatar">{String(c.name || c.email || "?").trim().charAt(0).toUpperCase()}</span>
                          <span>
                            <span className="ad-strong">
                              {c.name}
                              {topIds.has(c.id) && <span className="ad-tag ad-tag--gold">Top customer</span>}
                            </span>
                            <small>{c.email}</small>
                          </span>
                        </span>
                      </td>
                      <td data-label="Phone">{c.phone || <span className="ad-muted">—</span>}</td>
                      <td data-label="Orders" className="ad-num">
                        <span>
                          {c.orders_count}
                          {c.open_orders > 0 && <small className="ad-open">{c.open_orders} open</small>}
                        </span>
                      </td>
                      <td data-label="Total spent" className="ad-num ad-strong">
                        {formatMoney(c.total_spent)}
                      </td>
                      <td data-label="Last order">
                        {c.last_order_at ? shortDate(c.last_order_at) : <span className="ad-muted">No orders yet</span>}
                      </td>
                      <td data-label="Customer since">{shortDate(c.created_at)}</td>
                    </tr>
                  ))}
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

export default AdminCustomers;
