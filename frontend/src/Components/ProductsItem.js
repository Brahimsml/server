import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import SearchIcon from "@mui/icons-material/Search";
import TuneIcon from "@mui/icons-material/Tune";
import CloseIcon from "@mui/icons-material/Close";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCartOutlined";
import CheckIcon from "@mui/icons-material/Check";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import { CartContext } from "../Context/CartContext";
import WishlistButton from "./WishlistButton";
import {
  formatMoney,
  imageUrl,
  isBestSeller,
  isLowStock,
  isSoldOut,
  normalizeLabel,
  onImageError,
  productPath,
  toCartProduct,
  FALLBACK_IMG,
} from "../utils/shop";

const PAGE_SIZE = 12; // fills full rows of 2, 3 or 4

// Shop price filter
const PRICE_RANGES = [
  { key: "all", label: "Any price" },
  { key: "u100", label: "Under $100", min: 0, max: 100 },
  { key: "100-500", label: "$100 – $500", min: 100, max: 500 },
  { key: "500-1000", label: "$500 – $1,000", min: 500, max: 1000 },
  { key: "o1000", label: "Over $1,000", min: 1000, max: Infinity },
];

const inPriceRange = (product, key) => {
  const range = PRICE_RANGES.find((r) => r.key === key);
  if (!range || range.key === "all") return true;
  const price = Number(product.price || 0);
  return price >= range.min && price < range.max;
};

const brandOf = (product) => String(product.brand || "").trim();

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
  initialQuery = "", // e.g. from the navbar search (/shop?q=rtx)
  row = false, // one sideways-scrolling row instead of a grid (home, related products)
  rank, // optional: products where rank(p) is true come first (keeps the rest in order)
}) => {
  const [query, setQuery] = useState(initialQuery);

  // A new search from the navbar while the shop is already open
  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);
  const [sort, setSort] = useState("newest");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [priceRange, setPriceRange] = useState("all");
  const [brands, setBrands] = useState([]); // chosen brands (any of them)
  const [filtersOpen, setFiltersOpen] = useState(false); // phones: the filters panel
  const [shown, setShown] = useState(PAGE_SIZE); // "Show more" adds the next 12
  const [addedId, setAddedId] = useState(null);
  const addedTimer = useRef(null);
  const sideList = useRef(null);
  const rowRef = useRef(null);
  const [rowEnds, setRowEnds] = useState({ start: true, end: true });

  const { addToCart } = useContext(CartContext);

  useEffect(() => () => clearTimeout(addedTimer.current), []);

  // On phones the categories scroll sideways: keep the chosen one in view
  useEffect(() => {
    const list = sideList.current;
    const active = list?.querySelector(".is-active");
    if (!list || !active || list.scrollWidth <= list.clientWidth) return;
    list.scrollLeft = active.offsetLeft - list.offsetLeft - (list.clientWidth - active.offsetWidth) / 2;
  }, [category, products.length]);

  // Phones: the filters panel locks page scrolling and closes with Escape
  useEffect(() => {
    if (!filtersOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && setFiltersOpen(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [filtersOpen]);

  // Back to the first 12 whenever what's shown changes
  useEffect(() => {
    setShown(PAGE_SIZE);
  }, [category, query, sort, inStockOnly, priceRange, brands]);

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
        if (!inPriceRange(p, priceRange)) return false;
        if (brands.length && !brands.includes(brandOf(p))) return false;

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
        if (sort === "best") {
          const diff = Number(isBestSeller(b)) - Number(isBestSeller(a));
          if (diff) return diff;
        }
        return Number(b.id || 0) - Number(a.id || 0);
      })
      .sort((a, b) => (rank ? Number(rank(b)) - Number(rank(a)) : 0));
  }, [products, filter, category, query, sort, inStockOnly, priceRange, brands, rank]);

  // Counts next to the price and brand choices: products in the chosen category
  const inCategory = useMemo(
    () => products.filter((p) => (!filter || filter(p)) && (category === "All" || (p.category_name || "Other") === category)),
    [products, filter, category]
  );

  const brandList = useMemo(() => {
    const map = new Map();
    inCategory.forEach((p) => {
      const b = brandOf(p);
      if (b) map.set(b, (map.get(b) || 0) + 1);
    });
    // keep chosen brands listed even if this category has none
    brands.forEach((b) => map.has(b) || map.set(b, 0));
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [inCategory, brands]);

  const toggleBrand = (name) =>
    setBrands((list) => (list.includes(name) ? list.filter((b) => b !== name) : [...list, name]));

  // Row mode: show the arrows only when there is more to scroll that way
  const updateRowEnds = () => {
    const el = rowRef.current;
    if (!el) return;
    const start = el.scrollLeft <= 4;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    setRowEnds((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  };

  useEffect(() => {
    if (!row) return undefined;
    updateRowEnds();
    window.addEventListener("resize", updateRowEnds);
    return () => window.removeEventListener("resize", updateRowEnds);
  });

  const scrollRow = (dir) => {
    const el = rowRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  const visibleProducts = useMemo(
    () => filtered.slice(0, showPagination ? shown : limit || filtered.length),
    [filtered, shown, limit, showPagination]
  );

  // rows with only a few products keep 4 across, so wide screens don't show an empty slot
  const gridClass = row
    ? `pc-grid pc-grid--row ${!loading && visibleProducts.length <= 4 ? "pc-grid--few" : ""}`
    : "pc-grid";

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

  const clearFilters = () => {
    setSort("newest");
    setInStockOnly(false);
    setPriceRange("all");
    setBrands([]);
    setCategory("All");
  };

  const resetFilters = () => {
    setQuery("");
    clearFilters();
  };

  const sortSelect = (className) => (
    <select className={`mt-input ${className}`} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort products">
      <option value="newest">Newest first</option>
      <option value="best">Best sellers first</option>
      <option value="price-asc">Price: low to high</option>
      <option value="price-desc">Price: high to low</option>
      <option value="name">Name: A to Z</option>
    </select>
  );

  // How many filters differ from the default (shown on the phone "Filters" button)
  const activeFilters =
    (category !== "All" ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (sort !== "newest" ? 1 : 0) +
    (priceRange !== "all" ? 1 : 0) +
    brands.length;

  // Removable tags for every filter that's on ("Graphics Cards ×")
  const chips = [
    query.trim() && { key: "q", label: `“${query.trim()}”`, clear: () => setQuery("") },
    category !== "All" && { key: "cat", label: category, clear: () => setCategory("All") },
    priceRange !== "all" && {
      key: "price",
      label: PRICE_RANGES.find((r) => r.key === priceRange)?.label,
      clear: () => setPriceRange("all"),
    },
    ...brands.map((b) => ({ key: `brand-${b}`, label: b, clear: () => toggleBrand(b) })),
    inStockOnly && { key: "stock", label: "In stock", clear: () => setInStockOnly(false) },
  ].filter(Boolean);

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

          {sortSelect("pc-sort")}

          {showCategories && (
            <button
              type="button"
              className="pc-filters-btn"
              onClick={() => setFiltersOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={filtersOpen}
            >
              <TuneIcon fontSize="small" /> Filters
              {activeFilters > 0 && <span className="pc-filters-btn__count">{activeFilters}</span>}
            </button>
          )}
        </div>
      )}

      {showToolbar && !loading && (
        <p className="pc-results" aria-live="polite">
          {filtered.length === 0
            ? "No products match"
            : `Showing ${visibleProducts.length} of ${filtered.length} ${filtered.length === 1 ? "product" : "products"}`}
        </p>
      )}

      {showCategories && chips.length > 0 && (
        <div className="pc-chips" aria-label="Filters in use">
          {chips.map((c) => (
            <button key={c.key} type="button" className="pc-chip" onClick={c.clear} aria-label={`Remove filter ${c.label}`}>
              {c.label} <CloseIcon />
            </button>
          ))}
          {chips.length > 1 && (
            <button type="button" className="pc-chip-clear" onClick={resetFilters}>
              Clear all
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className={gridClass}>
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
          <div
            className={gridClass}
            ref={row ? rowRef : undefined}
            onScroll={row ? updateRowEnds : undefined}
          >
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
                    <WishlistButton product={product} className="pc-wish" />

                    <Link to={productPath(product)} className="pc-media__link" tabIndex={-1} aria-hidden="true">
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
                      <Link to={productPath(product)}>{product.name}</Link>
                    </h3>

                    <p className="pc-desc">{product.description || " "}</p>

                    <div className="pc-price-row">
                      <span className="pc-price">{formatMoney(product.price)}</span>
                      {/* stock only when it matters, like big shops */}
                      {soldOut ? (
                        <span className="pc-stock pc-stock--out">Out of stock</span>
                      ) : isLowStock(stock) ? (
                        <span className="pc-stock pc-stock--low">Only {stock} left</span>
                      ) : null}
                    </div>

                    <div className="pc-actions">
                      <button
                        type="button"
                        className={`mt-btn mt-btn--secondary mt-btn--sm pc-add ${justAdded ? "pc-added" : ""}`}
                        disabled={soldOut}
                        onClick={() => handleAdd(product)}
                        aria-label={`Add ${product.name} to cart`}
                      >
                        {justAdded ? (
                          <>
                            <CheckIcon /> <span className="pc-add__text">Added</span>
                          </>
                        ) : (
                          <>
                            <AddShoppingCartIcon /> <span className="pc-add__text">Add to cart</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {row && !(rowEnds.start && rowEnds.end) && (
            <div className="pc-row-arrows">
              <button type="button" onClick={() => scrollRow(-1)} disabled={rowEnds.start} aria-label="Scroll left">
                <ChevronLeftIcon />
              </button>
              <button type="button" onClick={() => scrollRow(1)} disabled={rowEnds.end} aria-label="Scroll right">
                <ChevronRightIcon />
              </button>
            </div>
          )}

          {showPagination && filtered.length > visibleProducts.length && (
            <div className="pc-more">
              <span className="pc-more__count">
                You've seen {visibleProducts.length} of {filtered.length} products
              </span>
              <span className="pc-more__bar" aria-hidden="true">
                <span style={{ width: `${(visibleProducts.length / filtered.length) * 100}%` }} />
              </span>
              <button type="button" className="mt-btn mt-btn--secondary" onClick={() => setShown((n) => n + PAGE_SIZE)}>
                Show more products
              </button>
            </div>
          )}
        </>
      )}
    </>
  );

  if (!showCategories) return <div className={row ? "pc pc--row" : "pc"}>{content}</div>;

  // Shop layout: filters in a sidebar next to the products;
  // on phones the sidebar becomes a panel that slides up ("Filters" button)
  const totalCount = products.filter((p) => !filter || filter(p)).length;
  const sideItems = [{ name: "All", label: "All products", count: totalCount }, ...categories];

  return (
    <div className={`pc pc--shop ${filtersOpen ? "is-filters-open" : ""}`}>
      <div className="pc-sheet-overlay" onClick={() => setFiltersOpen(false)} aria-hidden="true" />
      <aside
        className="pc-side"
        aria-label="Filters"
        role={filtersOpen ? "dialog" : undefined}
        aria-modal={filtersOpen ? "true" : undefined}
      >
        <div className="pc-sheet-head">
          <strong>Filters &amp; sort</strong>
          <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters">
            <CloseIcon />
          </button>
        </div>

        <div className="pc-sheet-sort">
          <h2 className="pc-side__title">Sort by</h2>
          {sortSelect("pc-sort-sheet")}
        </div>

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

        <h2 className="pc-side__title pc-side__title--gap">Price</h2>
        <div className="pc-side__list" role="radiogroup" aria-label="Price">
          {PRICE_RANGES.map((r) => {
            const count = r.key === "all" ? inCategory.length : inCategory.filter((p) => inPriceRange(p, r.key)).length;
            if (r.key !== "all" && !count && priceRange !== r.key) return null;
            return (
              <button
                key={r.key}
                type="button"
                role="radio"
                aria-checked={priceRange === r.key}
                className={`pc-side__item ${priceRange === r.key ? "is-active" : ""}`}
                onClick={() => setPriceRange(r.key)}
              >
                <span>{r.label}</span>
                <span className="pc-side__count">{count}</span>
              </button>
            );
          })}
        </div>

        {brandList.length > 1 && (
          <>
            <h2 className="pc-side__title pc-side__title--gap">Brand</h2>
            <div className="pc-brands">
              {brandList.map((b) => (
                <label key={b.name} className="pc-check">
                  <input type="checkbox" checked={brands.includes(b.name)} onChange={() => toggleBrand(b.name)} />
                  <span>{b.name}</span>
                  <span className="pc-side__count">{b.count}</span>
                </label>
              ))}
            </div>
          </>
        )}

        <h2 className="pc-side__title pc-side__title--gap">Availability</h2>
        <label className="pc-check">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
          />
          <span>In stock only</span>
        </label>

        <div className="pc-sheet-foot">
          {activeFilters > 0 && (
            <button
              type="button"
              className="mt-btn mt-btn--secondary"
              onClick={clearFilters}
            >
              Clear all
            </button>
          )}
          <button type="button" className="mt-btn mt-btn--primary" onClick={() => setFiltersOpen(false)}>
            Show {filtered.length} {filtered.length === 1 ? "product" : "products"}
          </button>
        </div>
      </aside>

      <div className="pc-main">{content}</div>
    </div>
  );
};

export default ProductsItem;
