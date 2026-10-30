import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import api from "../../api";
import { formatMoney, imageUrl, onImageError, FALLBACK_IMG, LOW_STOCK } from "../../utils/shop";

/*
  Dashboard sales for the days you pick (Today, 7 days, 30 days, this month, last month,
  this year, or your own dates): sales, orders, average order and items sold, compared with
  the same number of days just before; a chart; best sellers and top categories in those
  days; and products running low.
  Sales = orders that weren't cancelled, delivery included.
*/
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// Each quick choice gives { from, to } as YYYY-MM-DD (today included)
const RANGES = [
  { id: "today", label: "Today", get: (t) => [t, t] },
  { id: "7d", label: "7 days", get: (t) => [addDays(t, -6), t] },
  { id: "30d", label: "30 days", get: (t) => [addDays(t, -29), t] },
  { id: "month", label: "This month", get: (t) => [new Date(t.getFullYear(), t.getMonth(), 1), t] },
  { id: "lastmonth", label: "Last month", get: (t) => [new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0)] },
  { id: "year", label: "This year", get: (t) => [new Date(t.getFullYear(), 0, 1), t] },
];

const todayDate = () => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
};

const niceDate = (iso, withYear) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });

const barLabel = (iso, bucket) =>
  bucket === "month"
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short" })
    : niceDate(iso);

const compactMoney = (n) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${Math.round(n)}`;

const SalesOverview = () => {
  const [rangeId, setRangeId] = useState("30d");
  const [custom, setCustom] = useState(() => {
    const t = todayDate();
    return { from: dayKey(addDays(t, -29)), to: dayKey(t) };
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // the days asked for
  const preset = RANGES.find((r) => r.id === rangeId);
  const [from, to] = preset ? preset.get(todayDate()).map(dayKey) : [custom.from, custom.to];

  useEffect(() => {
    if (!from || !to) return;
    setLoading(true);
    api
      .get(`/admin/sales?low=${LOW_STOCK}&from=${from}&to=${to}`)
      .then((res) => {
        setData(res.data);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [from, to]);

  const picker = (
    <div className="ad-range">
      <div className="ad-seg ad-range__seg" role="tablist" aria-label="Which days">
        {RANGES.map((r) => (
          <button key={r.id} type="button" role="tab" aria-selected={rangeId === r.id} className={rangeId === r.id ? "is-active" : ""} onClick={() => setRangeId(r.id)}>
            {r.label}
          </button>
        ))}
        <button type="button" role="tab" aria-selected={rangeId === "custom"} className={rangeId === "custom" ? "is-active" : ""} onClick={() => setRangeId("custom")}>
          Custom
        </button>
      </div>
      {rangeId === "custom" && (
        <div className="ad-range__dates">
          <label>
            <span>From</span>
            <input type="date" className="mt-input" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
          </label>
          <label>
            <span>To</span>
            <input type="date" className="mt-input" value={custom.to} min={custom.from} max={dayKey(todayDate())} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
          </label>
        </div>
      )}
    </div>
  );

  if (error) {
    return (
      <section className="mt-panel ad-sales">
        <div className="ad-panel-head">
          <h2>Sales overview</h2>
          {picker}
        </div>
        <div className="mt-alert mt-alert--error" style={{ margin: 20 }}>
          We couldn't load the sales for those days.
        </div>
      </section>
    );
  }
  if (!data) {
    return <div className="mt-skeleton" style={{ height: 420, marginBottom: 20 }} />;
  }

  // an older backend (not restarted since the update) answers without the date-range numbers
  if (!data.totals) {
    return (
      <div className="mt-alert mt-alert--error" style={{ marginBottom: 20 }}>
        Restart the backend (Ctrl + C, then npm start) to see sales for the days you pick.
      </div>
    );
  }

  const { totals, previous, series, bucket, topProducts, topCategories, lowStock } = data;
  const max = Math.max(1, ...series.map((b) => b.sales));
  const change = previous.sales > 0 ? ((totals.sales - previous.sales) / previous.sales) * 100 : null;
  const sameYear = data.from.slice(0, 4) === data.to.slice(0, 4);
  const rangeText = data.from === data.to ? niceDate(data.from, true) : `${niceDate(data.from, !sameYear)} – ${niceDate(data.to, true)}`;
  const showAmounts = series.length <= 14;
  // at most ~12 dates under the chart (~6 on a phone)
  const labelEvery = Math.ceil(series.length / (window.innerWidth < 700 ? 6 : 12));
  const catMax = Math.max(1, ...topCategories.map((c) => c.sales));

  const kpis = [
    { label: "Sales", value: formatMoney(totals.sales), main: true },
    { label: "Orders", value: totals.orders },
    { label: "Average order", value: formatMoney(totals.average) },
    { label: "Items sold", value: totals.itemsSold },
  ];

  return (
    <>
      <section className={`mt-panel ad-sales ${loading ? "is-loading" : ""}`}>
        <div className="ad-panel-head ad-sales__head">
          <div>
            <h2>Sales overview</h2>
            <p className="ad-sales__note">
              {rangeText} · orders placed (cancelled ones not counted), delivery included
            </p>
          </div>
          {picker}
        </div>

        <div className="ad-sales__kpis">
          {kpis.map((k) => (
            <div key={k.label} className={`ad-sales__kpi ${k.main ? "is-main" : ""}`}>
              <span className="ad-sales__label">{k.label}</span>
              <strong className="ad-sales__value">{k.value}</strong>
              {k.main &&
                (change !== null ? (
                  <span className={`ad-sales__change ${change >= 0 ? "is-up" : "is-down"}`}>
                    {change >= 0 ? <TrendingUpIcon fontSize="small" /> : <TrendingDownIcon fontSize="small" />}
                    {change >= 0 ? "+" : ""}
                    {change.toFixed(0)}% vs the {data.days === 1 ? "day" : `${data.days} days`} before ({formatMoney(previous.sales)})
                  </span>
                ) : (
                  <span className="ad-sales__sub">No sales in the {data.days === 1 ? "day" : `${data.days} days`} before to compare with</span>
                ))}
            </div>
          ))}
        </div>

        <figure className="ad-chart ad-chart--range" aria-label={`Sales per ${bucket}`}>
          <div className="ad-chart__bars">
            {series.map((b, i) => (
              <div
                key={b.start}
                className="ad-chart__col"
                title={`${bucket === "week" ? "Week of " : ""}${barLabel(b.start, bucket)}: ${formatMoney(b.sales)} · ${b.orders} ${b.orders === 1 ? "order" : "orders"}`}
              >
                <span className="ad-chart__amount">{showAmounts && b.sales ? compactMoney(b.sales) : ""}</span>
                <span className="ad-chart__bar" style={{ height: `${Math.max(b.sales ? 4 : 0, (b.sales / max) * 100)}%` }} />
                <span className="ad-chart__week">{i % labelEvery === 0 ? barLabel(b.start, bucket) : ""}</span>
              </div>
            ))}
          </div>
          <figcaption>
            Sales per {bucket}
            {bucket === "week" && " (weeks start on Monday)"}
          </figcaption>
        </figure>

        {/* Same numbers as a table, for screen readers */}
        <table className="ad-sr-only">
          <caption>Sales per {bucket}</caption>
          <thead>
            <tr>
              <th>{bucket === "day" ? "Day" : bucket === "week" ? "Week of" : "Month"}</th>
              <th>Sales</th>
              <th>Orders</th>
            </tr>
          </thead>
          <tbody>
            {series.map((b) => (
              <tr key={b.start}>
                <td>{barLabel(b.start, bucket)}</td>
                <td>{formatMoney(b.sales)}</td>
                <td>{b.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="ad-grid-3">
        <section className="mt-panel">
          <div className="ad-panel-head">
            <h2>Best sellers</h2>
            <span className="ad-hint">{rangeText}</span>
          </div>
          {topProducts.length === 0 ? (
            <p className="ad-empty-line">No sales in these days.</p>
          ) : (
            <ol className="ad-rank">
              {topProducts.map((p, i) => (
                <li key={p.id ?? p.name}>
                  <span className="ad-rank__n">{i + 1}</span>
                  <img className="ad-thumb" src={imageUrl(p.image) || FALLBACK_IMG} alt="" onError={onImageError} />
                  <div>
                    <strong>{p.name}</strong>
                    <small>
                      {p.sold} sold · {formatMoney(p.sales)}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="mt-panel">
          <div className="ad-panel-head">
            <h2>Top categories</h2>
            <span className="ad-hint">{rangeText}</span>
          </div>
          {topCategories.length === 0 ? (
            <p className="ad-empty-line">No sales in these days.</p>
          ) : (
            <ul className="ad-catbars">
              {topCategories.map((c) => (
                <li key={c.name}>
                  <div className="ad-catbars__top">
                    <strong>{c.name}</strong>
                    <span>{formatMoney(c.sales)}</span>
                  </div>
                  <span className="ad-catbars__track">
                    <span style={{ width: `${Math.max(3, (c.sales / catMax) * 100)}%` }} />
                  </span>
                  <small>
                    {c.sold} {c.sold === 1 ? "item" : "items"} sold
                  </small>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-panel">
          <div className="ad-panel-head">
            <h2>Low stock</h2>
            <span className="ad-hint">{LOW_STOCK} or fewer left</span>
          </div>
          {lowStock.length === 0 ? (
            <p className="ad-empty-line">Everything is well stocked.</p>
          ) : (
            <ul className="ad-rank">
              {lowStock.map((p) => (
                <li key={p.id}>
                  <img className="ad-thumb" src={imageUrl(p.image) || FALLBACK_IMG} alt="" onError={onImageError} />
                  <div>
                    <strong>{p.name}</strong>
                    <small className={Number(p.stock_quantity) <= 0 ? "ad-stock-out" : "ad-stock-low"}>
                      {Number(p.stock_quantity) <= 0 ? "Sold out" : `Only ${p.stock_quantity} left`}
                    </small>
                  </div>
                  <Link to={`/products/update/${p.id}`} className="mt-btn mt-btn--secondary mt-btn--sm">
                    Restock
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
};

export default SalesOverview;
