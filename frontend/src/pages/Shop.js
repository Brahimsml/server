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
          <h1 className="mt-title">{query ? `Results for “${query}”` : isAll ? "All products" : category}</h1>
          <p className="mt-lead">
            {query
              ? "Change the words in the search box, or pick a category to narrow it down."
              : isAll
              ? "PC components, gaming gear, consoles and more. Search, filter and sort the full catalog."
              : `Browse our ${category.toLowerCase()}. Search or sort to find the right one.`}
          </p>
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
        />
      </div>
    </div>
  );
};

export default Shop;
