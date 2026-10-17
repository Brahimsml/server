import React from "react";
import { Link } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SearchIcon from "@mui/icons-material/Search";

// Page title row with optional back link and action buttons
export const PageHeader = ({ title, subtitle, back, actions }) => (
  <>
    {back && (
      <Link to={back.to} className="ad-back">
        <ArrowBackIcon fontSize="small" /> {back.label}
      </Link>
    )}
    <header className="ad-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="ad-head__actions">{actions}</div>}
    </header>
  </>
);

export const SearchBox = ({ value, onChange, placeholder }) => (
  <label className="ad-search">
    <SearchIcon fontSize="small" />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
    />
  </label>
);

// Tabs with counts, e.g. All 58 | Pending 6 | ...
export const FilterTabs = ({ tabs, value, onChange, label }) => (
  <div className="ad-tabs" role="tablist" aria-label={label}>
    {tabs.map((t) => (
      <button
        key={t.value}
        type="button"
        role="tab"
        aria-selected={value === t.value}
        className={value === t.value ? "is-active" : ""}
        onClick={() => onChange(t.value)}
      >
        {t.label} <span>{t.count}</span>
      </button>
    ))}
  </div>
);

// Horizontal bar split by status + legend with counts and percentages
export const StatusBreakdown = ({ items }) => {
  const total = items.reduce((sum, it) => sum + it.count, 0);
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <>
      <div className="ad-bar" role="img" aria-label={items.map((i) => `${i.label} ${i.count}`).join(", ")}>
        {items.map((it) =>
          it.count ? (
            <span key={it.key} className={`ad-c-${it.key}`} style={{ width: `${(it.count / total) * 100}%` }} />
          ) : null
        )}
      </div>
      <ul className="ad-legend">
        {items.map((it) => (
          <li key={it.key}>
            <i className={`ad-c-${it.key}`} />
            {it.label}
            <strong>{it.count}</strong>
            <small>{pct(it.count)}%</small>
          </li>
        ))}
      </ul>
    </>
  );
};

// Contact message statuses
const MESSAGE_STATUSES = { new: "New", read: "Read", done: "Done" };
export const messageStatus = (status) => {
  const key = String(status || "new").toLowerCase();
  return { key, label: MESSAGE_STATUSES[key] || key };
};
// map message status to badge colors
export const messageBadge = { new: "pending", read: "processing", done: "done" };

// Pull a readable error message out of an API error
export const apiError = (err, fallback) => err?.response?.data?.message || fallback;
