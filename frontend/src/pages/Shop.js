import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ProductsItem from "../Components/ProductsItem";
import api from "../api";
import "../Styles/theme.css";
import "../Styles/HomePage.css";
import "../Styles/Shop.css";
import usePageTitle from "../utils/usePageTitle";

// Full catalog. The chosen category lives in the address (/shop?category=Monitors),
// so links from the footer, home page and assistant open it directly and Back works.
const Shop = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") || "All";
  const query = searchParams.get("q") || "";
  usePageTitle(query ? `Search: ${query}` : category === "All" ? "Shop" : category);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sortHost, setSortHost] = useState(null); // where "Sort by" sits on the title row (computers)

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
    setSearchParams(next);
  };

  const isAll = category === "All";
  // how many products the title counts ("All products · 47 items", "Monitors · 6 items")
  const total = isAll ? products.length : products.filter((p) => p.category_name === category).length;

  return (
    <div className="mt-page hp hp-shop">
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
                <span aria-current="page">{category}</span>
              </>
            )}
          </nav>
          <div className="sh-titlerow">
            <h1 className="mt-title sh-title">
              {query ? `Results for “${query}”` : isAll ? "All products" : category}
              {!query && !loading && total > 0 && (
                <span className="sh-total">
                  {total} {total === 1 ? "item" : "items"}
                </span>
              )}
            </h1>
            {/* computers: "Sort by" sits here, on the right of the title */}
            <div className="sh-sort" ref={setSortHost} />
          </div>
        </header>

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
          sortHost={sortHost}
        />
      </div>
    </div>
  );
};

export default Shop;
