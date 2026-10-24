import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import api from "../../api";
import { formatMoney, imageUrl, onImageError, FALLBACK_IMG, LOW_STOCK } from "../../utils/shop";

/*
  Dashboard: sales per week (last 8 weeks), this month vs last month,
  best sellers (last 30 days) and products running low.
  Sales = orders that weren't cancelled, delivery included.
*/
const shortDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const compactMoney = (n) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${Math.round(n)}`;

const SalesOverview = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get(`/admin/sales?low=${LOW_STOCK}`)
      .then((res) => setData(res.data))
      .catch(() => setError(true));
  }, []);

  if (error) {
    return <div className="mt-alert mt-alert--error">We couldn't load the sales overview.</div>;
  }
  if (!data) {
    return <div className="mt-skeleton" style={{ height: 300, marginBottom: 20 }} />;
  }

  const { weeks, thisMonth, lastMonth, topProducts, lowStock } = data;
  const max = Math.max(1, ...weeks.map((w) => w.sales));
  const change = lastMonth.sales > 0 ? ((thisMonth.sales - lastMonth.sales) / lastMonth.sales) * 100 : null;
  const monthName = new Date().toLocaleDateString("en-US", { month: "long" });

  return (
    <>
      <section className="mt-panel ad-sales">
        <div className="ad-panel-head">
          <div>
            <h2>Sales overview</h2>
            <p className="ad-sales__note">Orders placed (cancelled ones not counted), delivery included</p>
          </div>
        </div>

        <div className="ad-sales__body">
          <div className="ad-sales__month">
            <span className="ad-sales__label">{monthName} so far</span>
            <strong className="ad-sales__value">{formatMoney(thisMonth.sales)}</strong>
            <span className="ad-sales__sub">
              {thisMonth.orders} {thisMonth.orders === 1 ? "order" : "orders"}
            </span>
            {change !== null ? (
              <span className={`ad-sales__change ${change >= 0 ? "is-up" : "is-down"}`}>
                {change >= 0 ? <TrendingUpIcon fontSize="small" /> : <TrendingDownIcon fontSize="small" />}
                {change >= 0 ? "+" : ""}
                {change.toFixed(0)}% vs last month ({formatMoney(lastMonth.sales)})
              </span>
            ) : (
              <span className="ad-sales__sub">No sales last month to compare with</span>
            )}
          </div>

          <figure className="ad-chart" aria-label="Sales per week, last 8 weeks">
            <div className="ad-chart__bars">
              {weeks.map((w) => (
                <div
                  key={w.week}
                  className="ad-chart__col"
                  title={`Week of ${shortDate(w.week)}: ${formatMoney(w.sales)} · ${w.orders} ${w.orders === 1 ? "order" : "orders"}`}
                >
                  <span className="ad-chart__amount">{w.sales ? compactMoney(w.sales) : ""}</span>
                  <span className="ad-chart__bar" style={{ height: `${Math.max(w.sales ? 4 : 0, (w.sales / max) * 100)}%` }} />
                  <span className="ad-chart__week">{shortDate(w.week)}</span>
                </div>
              ))}
            </div>
            <figcaption>Sales per week (weeks start on Monday)</figcaption>
          </figure>
        </div>

        {/* Same numbers as a table, for screen readers */}
        <table className="ad-sr-only">
          <caption>Sales per week</caption>
          <thead>
            <tr>
              <th>Week of</th>
              <th>Sales</th>
              <th>Orders</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.week}>
                <td>{shortDate(w.week)}</td>
                <td>{formatMoney(w.sales)}</td>
                <td>{w.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="ad-grid-2">
        <section className="mt-panel">
          <div className="ad-panel-head">
            <h2>Best sellers</h2>
            <span className="ad-hint">Last 30 days</span>
          </div>
          {topProducts.length === 0 ? (
            <p className="ad-empty-line">No sales in the last 30 days yet.</p>
          ) : (
            <ol className="ad-rank">
              {topProducts.map((p, i) => (
                <li key={p.id}>
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
