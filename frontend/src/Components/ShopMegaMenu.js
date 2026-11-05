import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import MenuIcon from "@mui/icons-material/Menu";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import api from "../api";
import { groupCategories, imageUrl, normalizeLabel, onImageError, FALLBACK_IMG, imageSrcSet } from "../utils/shop";

const categoryLink = (name) => `/shop?category=${encodeURIComponent(name)}`;

// a real mouse (hover works); touch screens and pens don't hover
const canHover = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/*
  "All categories" in the second menu row on computers: hover (or press the arrow) to open a panel with
  quick links and every category with a photo (in the admin's order); a click opens the Shop.
  Touch screens have no hover, so there a tap opens the panel instead (its "All products" link
  goes to the Shop). Products load the first time it opens.
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
    // touch screens: a tap anywhere else closes it (there's no "mouse leaving")
    const onDown = (e) => !wrap.current?.contains(e.target) && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
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
      .filter((c) => c.count > 0 || categories.some((x) => x.parent_id === c.id));
  }, [categories, products]);

  // Groups (Admin → Categories): main entries with their categories inside. With groups, the panel
  // works like Amazon / Noon: groups on the left, the hovered (or tapped) group's categories on the right.
  const mains = useMemo(
    () =>
      groupCategories(tiles)
        .map((g) => {
          const kids = g.children.filter((c) => c.count > 0);
          const total = g.count + kids.reduce((sum, c) => sum + c.count, 0);
          return { ...g, children: kids, total, image: g.image || kids.map((c) => c.image).find(Boolean) };
        })
        .filter((g) => g.total > 0),
    [tiles]
  );
  const hasGroups = mains.some((g) => g.children.length);
  const [activeId, setActiveId] = useState(null);
  const active = mains.find((g) => g.id === activeId) || mains[0];
  // what the tiles show: every category, or the active group's categories (or the entry itself)
  const shown = hasGroups ? (active?.children.length ? active.children : active ? [{ ...active, count: active.total }] : []) : mains.map((g) => ({ ...g, count: g.total }));

  // categories per row, like big store menus: up to 6 on big screens, 5 on laptops, 4 on small
  // laptops, always in even rows (9 → 5 + 4, 12 → 6 × 2); the CSS picks one by screen width
  const count = products === null ? 10 : shown.length;
  const perRow = (max) => Math.min(max, Math.ceil(count / Math.ceil(count / max))) || 1;

  // is part of the category list hidden below (so it scrolls)?
  const gridRef = useRef(null);
  const [more, setMore] = useState(false);
  const checkMore = () => {
    const g = gridRef.current;
    setMore(Boolean(g && g.scrollHeight - g.scrollTop - g.clientHeight > 8));
  };
  useEffect(() => {
    if (!open) return undefined;
    checkMore();
    window.addEventListener("resize", checkMore);
    return () => window.removeEventListener("resize", checkMore);
  }, [open, shown.length]);

  return (
    <div
      className={`nb-mega ${open ? "is-open" : ""}`}
      ref={wrap}
      onMouseEnter={() => canHover() && show()}
      onMouseLeave={() => canHover() && hide()}
      onBlur={(e) => !wrap.current?.contains(e.relatedTarget) && hide(0)}
    >
      <NavLink
        to="/shop"
        className={(s) => `${linkClass(s, "/shop")} nb-mega__link`}
        aria-expanded={open}
        onClick={(e) => {
          if (canHover()) return; // mouse: go to the Shop (the panel opened on hover)
          e.preventDefault(); // touch: show the categories first
          setOpen((v) => !v);
        }}
      >
        <MenuIcon fontSize="small" /> All categories
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
        <div className={`nb-mega__inner ${hasGroups ? "has-groups" : ""}`}>
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

          {hasGroups && (
            <ul className="nb-mega__groups">
              {mains.map((g) => (
                <li key={g.id}>
                  <Link
                    to={categoryLink(g.name)}
                    className={`nb-mega__group ${active?.id === g.id ? "is-active" : ""}`}
                    onMouseEnter={() => canHover() && setActiveId(g.id)}
                    onFocus={() => setActiveId(g.id)}
                    onClick={(e) => {
                      // touch: the first tap shows the group's categories; the next opens it
                      if (!canHover() && g.children.length && active?.id !== g.id) {
                        e.preventDefault();
                        setActiveId(g.id);
                      }
                    }}
                  >
                    <span>{g.name}</span>
                    {g.children.length > 0 && <ChevronRightIcon fontSize="small" />}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="nb-mega__cats">
          {hasGroups && active && (
            <div className="nb-mega__head">
              <strong>{active.name}</strong>
              <Link to={categoryLink(active.name)} className="mt-link">
                See all {active.total} <ArrowForwardIcon fontSize="inherit" />
              </Link>
            </div>
          )}
          <div
            ref={gridRef}
            onScroll={checkMore}
            className={`nb-mega__grid ${more ? "has-more" : ""}`}
            style={{ "--cols-xl": perRow(6), "--cols-lg": perRow(5), "--cols-md": perRow(4) }}
          >
            {products === null
              ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="mt-skeleton nb-mega__skeleton" />)
              : shown.map((c) => (
                  <Link key={c.id} to={categoryLink(c.name)} className="nb-mega__cat">
                    <span className="nb-mega__thumb">
                      <img src={imageUrl(c.image) || FALLBACK_IMG} srcSet={imageSrcSet(c.image, 320)} sizes="60px" alt="" loading="lazy" onError={onImageError} />
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
          {/* lots of categories: the list scrolls inside the panel; say so */}
          {more && (
            <p className="nb-mega__more" aria-hidden="true">
              {shown.length} categories · scroll for more <KeyboardArrowDownIcon fontSize="inherit" />
            </p>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopMegaMenu;
