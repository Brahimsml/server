import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ProductsItem from "../Components/ProductsItem";
import api from "../api";
import "../Styles/theme.css";
import "../Styles/HomePage.css";
import "../Styles/Shop.css";

// Full catalog. The chosen category lives in the address (/shop?category=Monitors),
// so links from the footer, home page and assistant open it directly and Back works.
const Shop = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") || "All";

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

  const changeCategory = (name) => {
    setSearchParams(name === "All" ? {} : { category: name });
  };

  const isAll = category === "All";

  return (
    <div className="mt-page hp">
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
          <h1 className="mt-title">{isAll ? "All products" : category}</h1>
          <p className="mt-lead">
            {isAll
              ? "Graphics cards, monitors, laptops and peripherals. Search, filter and sort the full catalog."
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
        />
      </div>
    </div>
  );
};

export default Shop;
