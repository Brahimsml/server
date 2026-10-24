import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SearchIcon from "@mui/icons-material/Search";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCartOutlined";
import CheckIcon from "@mui/icons-material/Check";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import { CartContext } from "../Context/CartContext";
import {
  formatMoney,
  imageUrl,
  isLowStock,
  isSoldOut,
  normalizeLabel,
  onImageError,
  toCartProduct,
  FALLBACK_IMG,
} from "../utils/shop";

const PAGE_SIZE = 8;

/*
  Product grid.
  - products / loading come from the parent (Home loads them once)
  - category + onCategoryChange: the parent controls the selected category
  - filter: optional extra filter, e.g. best sellers only
*/
const ProductsItem = ({
  products = [],
  loading = false,
  category = "All",
  onCategoryChange,
  filter,
  limit = null,
  showToolbar = true,
  showCategories = true,
  showPagination = true,
  emptyTitle = "No products found",
  emptyText = "Try another category, or clear the search.",
}) => {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [addedId, setAddedId] = useState(null);
  const addedTimer = useRef(null);
  const sideList = useRef(null);

  const { addToCart } = useContext(CartContext);
  const navigate = useNavigate();

  useEffect(() => () => clearTimeout(addedTimer.current), []);

  // On phones the categories scroll sideways: keep the chosen one in view
  useEffect(() => {
    const list = sideList.current;
    const active = list?.querySelector(".is-active");
    if (!list || !active || list.scrollWidth <= list.clientWidth) return;
    list.scrollLeft = active.offsetLeft - list.offsetLeft - (list.clientWidth - active.offsetWidth) / 2;
  }, [category, products.length]);

  // Back to page 1 whenever what's shown changes
  useEffect(() => {
    setPage(1);
  }, [category, query, sort, inStockOnly]);

  const categories = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      const name = p.category_name || "Other";
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return products
      .filter((p) => {
        if (filter && !filter(p)) return false;
        if (inStockOnly && isSoldOut(p)) return false;

        const catName = p.category_name || "Other";
        if (category !== "All" && catName !== category) return false;

        if (!q) return true;
        return `${p.name || ""} ${p.description || ""} ${catName}`.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const pa = Number(a.price || 0);
        const pb = Number(b.price || 0);

        if (sort === "price-asc") return pa - pb;
        if (sort === "price-desc") return pb - pa;
        if (sort === "name") return String(a.name || "").localeCompare(String(b.name || ""));
        return Number(b.id || 0) - Number(a.id || 0);
      });
  }, [products, filter, category, query, sort, inStockOnly]);

  const totalPages = showPagination ? Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)) : 1;

  const visibleProducts = useMemo(() => {
    if (!showPagination) return filtered.slice(0, limit || filtered.length);
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page, limit, showPagination]);

  const pageButtons = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);

    const pages = [1];
    const left = Math.max(2, page - 1);
    const right = Math.min(totalPages - 1, page + 1);
    if (left > 2) pages.push("…");
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push("…");
    pages.push(totalPages);
    return pages;
  }, [page, totalPages]);

  const setCategory = (name) => {
    if (onCategoryChange) onCategoryChange(name);
  };

  const handleAdd = (product) => {
    if (isSoldOut(product)) return;
    if (addToCart(toCartProduct(product))) {
      setAddedId(product.id);
      clearTimeout(addedTimer.current);
      addedTimer.current = setTimeout(() => setAddedId(null), 1600);
    }
  };

  const handleBuyNow = (product) => {
    if (isSoldOut(product)) return;
    if (addToCart(toCartProduct(product))) navigate("/cart");
  };

  const resetFilters = () => {
    setQuery("");
    setSort("newest");
    setInStockOnly(false);
    setCategory("All");
  };

  const goToPage = (p) => {
    setPage(p);
  };

  const firstShown = filtered.length ? (showPagination ? (page - 1) * PAGE_SIZE + 1 : 1) : 0;
  const lastShown = firstShown ? firstShown + visibleProducts.length - 1 : 0;

  const content = (
    <>
      {showToolbar && (
        <div className="pc-toolbar">
          <label className="pc-search">
            <SearchIcon fontSize="small" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products"
              aria-label="Search products"
            />
          </label>

          <select
            className="mt-input pc-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort products"
          >
            <option value="newest">Newest first</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="name">Name: A to Z</option>
          </select>
        </div>
      )}

      {showToolbar && !loading && (
        <p className="pc-results" aria-live="polite">
          {filtered.length === 0
            ? "No products match"
            : `Showing ${firstShown}–${lastShown} of ${filtered.length} ${filtered.length === 1 ? "product" : "products"}`}
        </p>
      )}

      {loading ? (
        <div className="pc-grid">
          {Array.from({ length: limit || PAGE_SIZE }).map((_, i) => (
            <div key={i} className="mt-skeleton pc-skeleton" />
          ))}
        </div>
      ) : visibleProducts.length === 0 ? (
        <div className="mt-panel mt-empty">
          <div className="mt-empty__icon">
            <Inventory2OutlinedIcon fontSize="inherit" />
          </div>
          <h3>{emptyTitle}</h3>
          <p>{emptyText}</p>
          {showToolbar && (
            <button type="button" className="mt-btn mt-btn--secondary" onClick={resetFilters}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="pc-grid">
            {visibleProducts.map((product) => {
              const soldOut = isSoldOut(product);
              const stock = Number(product.stock_quantity);
              const label = normalizeLabel(product.label);
              const justAdded = addedId === product.id;

              return (
                <article className="pc-card" key={product.id}>
                  <div className="pc-media">
                    {label && (
                      <span className={`pc-label ${/best/i.test(label) ? "pc-label--best" : /^new/i.test(label) ? "pc-label--new" : ""}`}>
                        {/best/i.test(label) ? "Best Seller" : label}
                      </span>
                    )}
                    {soldOut && <span className="pc-label pc-label--out">Sold out</span>}

                    <Link to={`/product/${product.id}`} className="pc-media__link" tabIndex={-1} aria-hidden="true">
                      <img
                        src={imageUrl(product.image) || FALLBACK_IMG}
                        alt=""
                        loading="lazy"
                        onError={onImageError}
                      />
                    </Link>
                  </div>

                  <div className="pc-body">
                    <span className="pc-cat">{product.category_name}</span>

                    <h3 className="pc-name" title={product.name}>
                      <Link to={`/product/${product.id}`}>{product.name}</Link>
                    </h3>

                    <p className="pc-desc">{product.description || " "}</p>

                    <div className="pc-price-row">
                      <span className="pc-price">{formatMoney(product.price)}</span>
                      {soldOut ? (
                        <span className="pc-stock pc-stock--out">Out of stock</span>
                      ) : isLowStock(stock) ? (
                        <span className="pc-stock pc-stock--low">Only {stock} left</span>
                      ) : (
                        <span className="pc-stock pc-stock--in">In stock</span>
                      )}
                    </div>

                    <div className="pc-actions">
                      <button
                        type="button"
                        className={`mt-btn mt-btn--secondary mt-btn--sm ${justAdded ? "pc-added" : ""}`}
                        disabled={soldOut}
                        onClick={() => handleAdd(product)}
                        aria-label={`Add ${product.name} to cart`}
                      >
                        {justAdded ? (
                          <>
                            <CheckIcon /> Added
                          </>
                        ) : (
                          <>
                            <AddShoppingCartIcon /> Add to cart
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        className="mt-btn mt-btn--primary mt-btn--sm"
                        disabled={soldOut}
                        onClick={() => handleBuyNow(product)}
                      >
                        Buy now
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {showPagination && totalPages > 1 && (
            <nav className="pc-pagination" aria-label="Product pages">
              <button
                type="button"
                onClick={() => goToPage(Math.max(1, page - 1))}
                disabled={page === 1}
                aria-label="Previous page"
              >
                <ChevronLeftIcon fontSize="small" />
              </button>

              {pageButtons.map((p, idx) =>
                p === "…" ? (
                  <span key={`dots-${idx}`} className="pc-pagination__dots">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={page === p ? "is-active" : ""}
                    aria-current={page === p ? "page" : undefined}
                    onClick={() => goToPage(p)}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => goToPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
              >
                <ChevronRightIcon fontSize="small" />
              </button>
            </nav>
          )}
        </>
      )}
    </>
  );

  if (!showCategories) return <div className="pc">{content}</div>;

  // Shop layout: filters in a sidebar (a tab strip on phones) next to the products
  const totalCount = products.filter((p) => !filter || filter(p)).length;
  const sideItems = [{ name: "All", label: "All products", count: totalCount }, ...categories];

  return (
    <div className="pc pc--shop">
      <aside className="pc-side" aria-label="Filters">
        <h2 className="pc-side__title">Categories</h2>
        <nav className="pc-side__list" aria-label="Categories" ref={sideList}>
          {sideItems.map((cat) => (
            <button
              key={cat.name}
              type="button"
              aria-current={category === cat.name ? "true" : undefined}
              className={`pc-side__item ${category === cat.name ? "is-active" : ""}`}
              onClick={() => setCategory(cat.name)}
            >
              <span>{cat.label || cat.name}</span>
              <span className="pc-side__count">{cat.count}</span>
            </button>
          ))}
        </nav>

        <h2 className="pc-side__title pc-side__title--gap">Availability</h2>
        <label className="pc-check">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
          />
          <span>In stock only</span>
        </label>
      </aside>

      <div className="pc-main">{content}</div>
    </div>
  );
};

export default ProductsItem;
