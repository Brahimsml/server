import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TuneIcon from "@mui/icons-material/Tune";
import ProductsItem from "../Components/ProductsItem";
import api from "../api";
import "../Styles/theme.css";
import "../Styles/HomePage.css";
import "../Styles/Shop.css";
import usePageTitle from "../utils/usePageTitle";
import { useModernLook } from "../utils/look";
import { byCategoryOrder, inCategoryOf, saleOf } from "../utils/shop";

// Full catalog. The chosen category lives in the address (/shop?category=Monitors),
// so links from the footer, home page and assistant open it directly and Back works.
const Shop = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") || "All";
  const query = searchParams.get("q") || "";
  const saleOnly = searchParams.get("sale") === "1"; // "See all deals"
  usePageTitle(query ? `Search: ${query}` : category === "All" ? (searchParams.get("sale") === "1" ? "Deals" : "Shop") : category);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sortHost, setSortHost] = useState(null); // where "Sort by" sits on the title row (computers)
  const modern = useModernLook(); // modern look preview (Styles/ModernPreview.css)
  const [hideFilters, setHideFilters] = useState(false); // modern look, computers: products take the full width

  useEffect(() => {
    let alive = true;
    api
      .get("/products")
      .then((res) => alive && setProducts(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error("Failed to load products", err);
        if (alive) setLoadError(true);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // Keep the search when switching category, so "rtx" + Laptops works
  const changeCategory = (name) => {
    const next = {};
    if (name !== "All") next.category = name;
    if (query) next.q = query;
    if (saleOnly) next.sale = "1";
    // replace, not a new history entry: tapping through categories doesn't fill the Back button,
    // and iPhones stop a page that changes its address more than 100 times in 30 seconds
    setSearchParams(next, { replace: true });
  };

  const isAll = category === "All";
  // how many products the title counts ("All products · 47 items", "Monitors · 6 items")
  const total = products.filter((p) => inCategoryOf(p, category) && (!saleOnly || saleOf(p))).length;
  // the group a chosen category belongs to (for the breadcrumb: Shop › Gaming Gear › Keyboards)
  const group = isAll ? null : products.find((p) => p.category_name === category)?.category_parent || null;

  // Modern look: every category as a pill under the title (the admin's order)
  const pills = modern
    ? Array.from(new Map(products.map((p) => [p.category_name, { name: p.category_name, order: p.category_order }])).values())
        .filter((c) => c.name)
        .sort(byCategoryOrder)
    : [];

  return (
    <div className={`mt-page hp hp-shop ${modern ? "mh mh-shop" : ""} ${modern && hideFilters ? "is-nofilters" : ""}`}>
      <div className="mt-container">
        <header className="sh-head">
          <nav className="sh-crumbs" aria-label="Breadcrumb">
            <Link to="/home">Home</Link>
            <ChevronRightIcon fontSize="inherit" />
            {isAll ? (
              <span aria-current="page">Shop</span>
            ) : (
              <>
                <Link to="/shop">Shop</Link>
                <ChevronRightIcon fontSize="inherit" />
                {group && (
                  <>
                    <Link to={`/shop?category=${encodeURIComponent(group)}`}>{group}</Link>
                    <ChevronRightIcon fontSize="inherit" />
                  </>
                )}
                <span aria-current="page">{category}</span>
              </>
            )}
          </nav>
          <div className="sh-titlerow">
            <h1 className="mt-title sh-title">
              {query ? `Results for “${query}”` : isAll ? (saleOnly ? "Deals" : "All products") : category}
              {!query && !loading && total > 0 && (
                <span className="sh-total">
                  {total} {total === 1 ? "item" : "items"}
                </span>
              )}
            </h1>
            {/* computers: "Sort by" sits here, on the right of the title (modern look: in the bar below) */}
            {!modern && <div className="sh-sort" ref={setSortHost} />}
          </div>
          {pills.length > 0 && (
            <div className="mh-pills" role="group" aria-label="Categories">
              <button type="button" className={isAll ? "is-active" : ""} aria-pressed={isAll} onClick={() => changeCategory("All")}>
                All
              </button>
              {pills.map((c) => (
                <button key={c.name} type="button" className={category === c.name ? "is-active" : ""} aria-pressed={category === c.name} onClick={() => changeCategory(c.name)}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </header>

        {/* modern look, computers: show / hide the filters on the left, sort on the right */}
        {modern && (
          <div className="mh-shopbar">
            <button type="button" className="mh-shopbar__toggle" aria-pressed={!hideFilters} onClick={() => setHideFilters((v) => !v)}>
              <TuneIcon fontSize="inherit" /> {hideFilters ? "Show filters" : "Hide filters"}
            </button>
            <div className="sh-sort" ref={setSortHost} />
          </div>
        )}

        {loadError && (
          <div className="mt-alert mt-alert--error hp-error" role="alert">
            We couldn't load products right now. Please refresh the page in a moment.
          </div>
        )}

        <ProductsItem
          products={products}
          loading={loading}
          category={category}
          onCategoryChange={changeCategory}
          initialQuery={query}
          initialSale={saleOnly}
          onSaleChange={(on) => {
            const next = Object.fromEntries(searchParams);
            if (on) next.sale = "1";
            else delete next.sale;
            setSearchParams(next, { replace: true });
          }}
          onQueryClear={() => {
            const next = {};
            if (category !== "All") next.category = category;
            setSearchParams(next, { replace: true });
          }}
          sortHost={sortHost}
        />
      </div>
    </div>
  );
};

export default Shop;
