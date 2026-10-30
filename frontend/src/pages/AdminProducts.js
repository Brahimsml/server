import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopyOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import api from "../api";
import { useAdmin } from "../Components/admin/AdminLayout";
import { PageHeader, SearchBox, apiError } from "../Components/admin/AdminUI";
import StockStepper from "../Components/admin/StockStepper";
import { formatMoney, imageUrl, isBestSeller, normalizeLabel, onImageError, FALLBACK_IMG, LOW_STOCK } from "../utils/shop";

function AdminProducts() {
  const { notify, confirm } = useAdmin();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // all / live / hidden
  const [allCategories, setAllCategories] = useState([]); // for "Move to category"

  // Bulk edit: tick products, pick a change, Apply
  const [selected, setSelected] = useState(() => new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  // ?all=1: the admin also gets the hidden products
  const fetchProducts = () =>
    api
      .get("/products?all=1")
      .then((res) => {
        setProducts(Array.isArray(res.data) ? res.data : []);
        setError("");
      })
      .catch((err) => {
        console.error("Failed to fetch products:", err);
        setError("We couldn't load products. Please refresh the page.");
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchProducts();
    api
      .get("/categories")
      .then((res) => setAllCategories(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  const isLive = (p) => p.active === undefined || !!Number(p.active);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category_name).filter(Boolean))].sort(),
    [products]
  );

  const counts = useMemo(() => {
    const stock = (p) => Number(p.stock_quantity) || 0;
    return {
      low: products.filter((p) => stock(p) > 0 && stock(p) <= LOW_STOCK).length,
      out: products.filter((p) => stock(p) <= 0).length,
      hidden: products.filter((p) => !isLive(p)).length,
    };
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const stock = Number(p.stock_quantity) || 0;
      if (category !== "all" && p.category_name !== category) return false;
      if (stockFilter === "low" && !(stock > 0 && stock <= LOW_STOCK)) return false;
      if (stockFilter === "out" && stock > 0) return false;
      if (statusFilter === "live" && !isLive(p)) return false;
      if (statusFilter === "hidden" && isLive(p)) return false;
      if (!q) return true;
      return `${p.name} ${p.category_name} ${p.label || ""}`.toLowerCase().includes(q);
    });
  }, [products, search, category, stockFilter, statusFilter]);

  // ===== Show / hide one product (nothing is deleted) =====
  const toggleLive = async (p) => {
    const next = !isLive(p);
    setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, active: next ? 1 : 0 } : x)));
    try {
      await api.put(`/products/${p.id}/active`, { active: next });
      notify(next ? `"${p.name}" is back in the shop` : `"${p.name}" is hidden from the shop`);
    } catch (err) {
      setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, active: next ? 0 : 1 } : x)));
      notify(apiError(err, "We couldn't change this product."), "error");
    }
  };

  // ===== Bulk edit =====
  // A new filter or search starts a fresh selection
  useEffect(() => setSelected(new Set()), [search, category, stockFilter, statusFilter]);

  const allTicked = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allTicked ? new Set() : new Set(filtered.map((p) => p.id)));

  const BULK_ACTIONS = {
    show: { label: "Show in the shop" },
    hide: { label: "Hide from the shop" },
    category: { label: "Move to category…", field: "category" },
    price_set: { label: "Set the price to…", field: "money", placeholder: "New price" },
    price_percent: { label: "Change the price by %…", field: "percent", placeholder: "e.g. -10 or 5" },
    stock_set: { label: "Set the stock to…", field: "number", placeholder: "New stock" },
  };
  const bulkField = BULK_ACTIONS[bulkAction]?.field;

  const applyBulk = async () => {
    const ids = [...selected];
    const value = Number(bulkValue);
    if (!bulkAction || !ids.length) return;
    if (bulkField && (bulkValue === "" || Number.isNaN(value))) {
      notify(bulkField === "category" ? "Choose a category." : "Enter a number first.", "error");
      return;
    }
    const n = `${ids.length} ${ids.length === 1 ? "product" : "products"}`;
    const what = {
      show: `Show ${n} in the shop?`,
      hide: `Hide ${n} from the shop?`,
      category: `Move ${n} to ${allCategories.find((c) => c.id === value)?.name || "this category"}?`,
      price_set: `Set the price of ${n} to ${formatMoney(value)}?`,
      price_percent: `${value > 0 ? "Raise" : "Lower"} the price of ${n} by ${Math.abs(value)}%?`,
      stock_set: `Set the stock of ${n} to ${value}?`,
    }[bulkAction];
    const ok = await confirm({
      title: what,
      message:
        bulkAction === "hide"
          ? "Customers won't see them any more. Nothing is deleted; you can show them again any time."
          : bulkAction === "price_percent"
          ? "Prices are rounded to the cent."
          : "This changes all the ticked products at once.",
      confirmLabel: "Apply",
      cancelLabel: "Go back",
    });
    if (!ok) return;

    setBulkBusy(true);
    try {
      await api.put("/products/bulk", { ids, action: bulkAction, value });
      await fetchProducts();
      notify(`${n} updated`);
      setSelected(new Set());
      setBulkAction("");
      setBulkValue("");
    } catch (err) {
      notify(apiError(err, "We couldn't update those products."), "error");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleDelete = async (product) => {
    const ok = await confirm({
      title: "Delete product?",
      message: `"${product.name}" will be removed from the store. This can't be undone.`,
      confirmLabel: "Delete product",
      danger: true,
    });
    if (!ok) return;

    try {
      await api.delete(`/products/${product.id}`);
      setProducts((list) => list.filter((p) => p.id !== product.id));
      notify(`"${product.name}" was deleted`);
    } catch (err) {
      console.error(err);
      notify(apiError(err, "We couldn't delete this product."), "error");
    }
  };

  const filtersActive = search || category !== "all" || stockFilter !== "all" || statusFilter !== "all";

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={
          loading
            ? "Loading products…"
            : `${products.length} products · ${counts.low} low on stock · ${counts.out} sold out${counts.hidden ? ` · ${counts.hidden} hidden` : ""}`
        }
        actions={
          <Link to="/products/add" className="mt-btn mt-btn--primary">
            <AddIcon /> Add product
          </Link>
        }
      />

      {error && <div className="mt-alert mt-alert--error">{error}</div>}

      <section className="mt-panel">
        <div className="ad-toolbar">
          <SearchBox value={search} onChange={setSearch} placeholder="Search products" />

          <select className="mt-input" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select className="mt-input" value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} aria-label="Stock">
            <option value="all">Any stock</option>
            <option value="low">Low stock ({counts.low})</option>
            <option value="out">Sold out ({counts.out})</option>
          </select>

          <select className="mt-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Shown or hidden">
            <option value="all">Shown &amp; hidden</option>
            <option value="live">Shown in the shop</option>
            <option value="hidden">Hidden ({counts.hidden})</option>
          </select>
        </div>

        {loading ? (
          <div className="ad-panel-body" style={{ display: "grid", gap: 10 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="mt-skeleton" style={{ height: 56, borderRadius: 10 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-empty">
            <div className="mt-empty__icon">
              <Inventory2OutlinedIcon fontSize="inherit" />
            </div>
            <h3>{products.length === 0 ? "No products yet" : "No products match"}</h3>
            <p>{products.length === 0 ? "Add your first product to start selling." : "Try a different search or filter."}</p>
            {filtersActive ? (
              <button
                type="button"
                className="mt-btn mt-btn--secondary"
                onClick={() => {
                  setSearch("");
                  setCategory("all");
                  setStockFilter("all");
                  setStatusFilter("all");
                }}
              >
                Clear filters
              </button>
            ) : (
              <Link to="/products/add" className="mt-btn mt-btn--primary">
                <AddIcon /> Add product
              </Link>
            )}
          </div>
        ) : (
          <>
            {selected.size > 0 ? (
              <div className="ad-bulk" role="region" aria-label="Change several products">
                <strong>
                  {selected.size} {selected.size === 1 ? "product" : "products"} selected
                </strong>
                <select
                  className="mt-input"
                  value={bulkAction}
                  onChange={(e) => {
                    setBulkAction(e.target.value);
                    setBulkValue("");
                  }}
                  aria-label="What to change"
                >
                  <option value="">Change…</option>
                  {Object.entries(BULK_ACTIONS).map(([value, a]) => (
                    <option key={value} value={value}>
                      {a.label}
                    </option>
                  ))}
                </select>
                {bulkField === "category" && (
                  <select className="mt-input" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} aria-label="Category">
                    <option value="">Choose a category</option>
                    {allCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
                {bulkField && bulkField !== "category" && (
                  <input
                    className="mt-input ad-bulk__value"
                    type="number"
                    step={bulkField === "money" ? "0.01" : "1"}
                    min={bulkField === "percent" ? "-90" : "0"}
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                    placeholder={BULK_ACTIONS[bulkAction].placeholder}
                    aria-label={BULK_ACTIONS[bulkAction].placeholder}
                  />
                )}
                <button type="button" className="mt-btn mt-btn--primary mt-btn--sm" onClick={applyBulk} disabled={!bulkAction || bulkBusy}>
                  {bulkBusy ? "Updating…" : "Apply"}
                </button>
                <button type="button" className="mt-link" onClick={() => setSelected(new Set())} disabled={bulkBusy}>
                  Clear
                </button>
              </div>
            ) : (
              <div className="ad-meta">
                Showing {filtered.length} of {products.length} · tick products to change several at once
              </div>
            )}
            <div className="ad-table-wrap">
              <table className="ad-table ad-products">
                <thead>
                  <tr>
                    <th className="ad-check-cell">
                      <input
                        type="checkbox"
                        className="ad-check"
                        checked={allTicked}
                        onChange={toggleAll}
                        aria-label="Select all products shown"
                      />
                    </th>
                    <th>Product</th>
                    <th>Category</th>
                    <th className="ad-num">Price</th>
                    <th>Stock</th>
                    <th>In shop</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const label = normalizeLabel(p.label);
                    const live = isLive(p);
                    return (
                      <tr key={p.id} className={`${selected.has(p.id) ? "is-selected" : ""} ${live ? "" : "is-hidden"}`}>
                        <td className="ad-check-cell">
                          <input
                            type="checkbox"
                            className="ad-check"
                            checked={selected.has(p.id)}
                            onChange={() => toggle(p.id)}
                            aria-label={`Select ${p.name}`}
                          />
                        </td>
                        <td className="ad-cell-full">
                          <div className="ad-product">
                            <img
                              className="ad-thumb"
                              src={imageUrl(p.image) || FALLBACK_IMG}
                              alt=""
                              loading="lazy"
                              onError={onImageError}
                            />
                            <div>
                              <strong>{p.name}</strong>
                              {label && (
                                <span className={`mt-badge ${isBestSeller(p) ? "mt-badge--pending" : "mt-badge--neutral"}`}>
                                  {isBestSeller(p) ? "Best Seller" : label}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td data-label="Category">{p.category_name}</td>
                        <td data-label="Price" className="ad-num ad-strong">
                          {formatMoney(p.price)}
                        </td>
                        <td data-label="Stock">
                          <StockStepper
                            product={p}
                            onSaved={(next) =>
                              setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, stock_quantity: next } : x)))
                            }
                            onError={(err) => notify(apiError(err, `We couldn't save the stock for "${p.name}".`), "error")}
                          />
                        </td>
                        <td data-label="In shop">
                          <label className="ad-switch ad-product-switch" title={live ? "Shown in the shop" : "Hidden from customers"}>
                            <input
                              type="checkbox"
                              checked={live}
                              onChange={() => toggleLive(p)}
                              aria-label={`Show ${p.name} in the shop`}
                            />
                            <span>{live ? "Shown" : "Hidden"}</span>
                          </label>
                        </td>
                        <td className="ad-actions-cell">
                          <div className="ad-row-actions">
                            <Link
                              to={`/products/update/${p.id}`}
                              className="ad-icon-btn"
                              aria-label={`Edit ${p.name}`}
                              title="Edit"
                            >
                              <EditOutlinedIcon />
                            </Link>
                            <Link
                              to={`/products/add?copy=${p.id}`}
                              className="ad-icon-btn"
                              aria-label={`Duplicate ${p.name}`}
                              title="Duplicate (e.g. for another color)"
                            >
                              <ContentCopyIcon />
                            </Link>
                            <button
                              type="button"
                              className="ad-icon-btn ad-icon-btn--danger"
                              onClick={() => handleDelete(p)}
                              aria-label={`Delete ${p.name}`}
                              title="Delete"
                            >
                              <DeleteOutlineIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  );
}

export default AdminProducts;
