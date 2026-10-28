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

  const fetchProducts = () =>
    api
      .get("/products")
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
  }, []);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category_name).filter(Boolean))].sort(),
    [products]
  );

  const counts = useMemo(() => {
    const stock = (p) => Number(p.stock_quantity) || 0;
    return {
      low: products.filter((p) => stock(p) > 0 && stock(p) <= LOW_STOCK).length,
      out: products.filter((p) => stock(p) <= 0).length,
    };
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const stock = Number(p.stock_quantity) || 0;
      if (category !== "all" && p.category_name !== category) return false;
      if (stockFilter === "low" && !(stock > 0 && stock <= LOW_STOCK)) return false;
      if (stockFilter === "out" && stock > 0) return false;
      if (!q) return true;
      return `${p.name} ${p.category_name} ${p.label || ""}`.toLowerCase().includes(q);
    });
  }, [products, search, category, stockFilter]);

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

  const filtersActive = search || category !== "all" || stockFilter !== "all";

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={
          loading
            ? "Loading products…"
            : `${products.length} products · ${counts.low} low on stock · ${counts.out} sold out`
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
            <div className="ad-meta">
              Showing {filtered.length} of {products.length}
            </div>
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th className="ad-num">Price</th>
                    <th>Stock</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const label = normalizeLabel(p.label);
                    return (
                      <tr key={p.id}>
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
