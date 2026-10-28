import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import api from "../api";
import { formatMoney, imageUrl, isBestSeller, normalizeLabel, onImageError, productPath, FALLBACK_IMG } from "../utils/shop";

const categoryLink = (name) => `/shop?category=${encodeURIComponent(name)}`;

/*
  "Shop" in the top bar on computers: hover (or press the arrow) to open a panel with
  quick links, every category with a photo (in the admin's order) and a best seller.
  Products load the first time it opens.
*/
const ShopMegaMenu = ({ linkClass }) => {
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState(null);
  const timer = useRef(null);
  const wrap = useRef(null);

  const show = (delay = 120) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = (delay = 180) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), delay);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  // Close when the page changes, or with Escape
  useEffect(() => setOpen(false), [pathname, search]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Load once, the first time the panel opens
  useEffect(() => {
    if (!open || products) return;
    api.get("/categories").then((res) => setCategories(Array.isArray(res.data) ? res.data : [])).catch(() => {});
    api
      .get("/products")
      .then((res) => setProducts(Array.isArray(res.data) ? res.data : []))
      .catch(() => setProducts([]));
  }, [open, products]);

  // Each category with its count and a photo (its priciest labelled product, else its priciest)
  const tiles = useMemo(() => {
    const list = products || [];
    return categories
      .map((c) => {
        const items = list.filter((p) => p.category_id === c.id);
        const pick = [...items]
          .filter((p) => p.image)
          .sort((a, b) => Number(!!normalizeLabel(b.label)) - Number(!!normalizeLabel(a.label)) || Number(b.price) - Number(a.price))[0];
        return { ...c, count: items.length, image: c.image || pick?.image }; // chosen picture first
      })
      .filter((c) => c.count > 0);
  }, [categories, products]);

  const spotlight = useMemo(() => {
    const list = (products || []).filter((p) => p.image && Number(p.stock_quantity) > 0);
    return list.filter(isBestSeller).sort((a, b) => Number(b.price) - Number(a.price))[0] || list[0];
  }, [products]);

  return (
    <div
      className={`nb-mega ${open ? "is-open" : ""}`}
      ref={wrap}
      onMouseEnter={() => show()}
      onMouseLeave={() => hide()}
      onBlur={(e) => !wrap.current?.contains(e.relatedTarget) && hide(0)}
    >
      <NavLink to="/shop" className={(s) => linkClass(s, "/shop")}>
        Shop
      </NavLink>
      <button
        type="button"
        className="nb-mega__toggle"
        aria-label="Show all categories"
        aria-expanded={open}
        aria-controls="nb-mega-panel"
        onClick={() => setOpen((v) => !v)}
      >
        <KeyboardArrowDownIcon />
      </button>

      <div id="nb-mega-panel" className="nb-mega__panel" role="region" aria-label="Shop by category" hidden={!open}>
        <div className="nb-mega__inner">
          <div className="nb-mega__side">
            <span className="nb-mega__title">Shop</span>
            <Link to="/shop" className="nb-mega__all">
              All products <ArrowForwardIcon fontSize="inherit" />
            </Link>
            <Link to="/home#new-arrivals">New arrivals</Link>
            <Link to="/home#best-sellers">Best sellers</Link>
            <Link to="/wishlist">Your wishlist</Link>
            <Link to="/menu">Visit a store</Link>
          </div>

          <div className="nb-mega__grid">
            {products === null
              ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="mt-skeleton nb-mega__skeleton" />)
              : tiles.map((c) => (
                  <Link key={c.id} to={categoryLink(c.name)} className="nb-mega__cat">
                    <span className="nb-mega__thumb">
                      <img src={imageUrl(c.image) || FALLBACK_IMG} alt="" loading="lazy" onError={onImageError} />
                    </span>
                    <span className="nb-mega__name">
                      <strong>{c.name}</strong>
                      <small>
                        {c.count} {c.count === 1 ? "product" : "products"}
                      </small>
                    </span>
                  </Link>
                ))}
          </div>

          {spotlight && (
            <Link to={productPath(spotlight)} className="nb-mega__spot">
              <span className="nb-mega__spot-label">{isBestSeller(spotlight) ? "Best seller" : "Featured"}</span>
              <span className="nb-mega__spot-img">
                <img src={imageUrl(spotlight.image)} alt="" onError={onImageError} />
              </span>
              <strong>{spotlight.name}</strong>
              <span className="nb-mega__spot-price">{formatMoney(spotlight.price)}</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShopMegaMenu;
