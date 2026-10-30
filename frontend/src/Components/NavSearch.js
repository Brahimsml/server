import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import api from "../api";
import { formatMoney, imageUrl, onImageError, productPath, FALLBACK_IMG } from "../utils/shop";

/*
  Search box in the menu bar, with live suggestions.
  - wide screens: always visible in the bar
  - narrow screens: a search icon opens it under the bar
  Enter (or "See all results") opens the shop filtered by the words typed.
  On computers a category picker narrows the search, and "/" jumps to the box.
*/
const MAX_SUGGESTIONS = 6;

let productsCache = null; // loaded once, the first time someone uses the search
let categoriesCache = null;

const matches = (product, words) => {
  const text = `${product.name || ""} ${product.category_name || ""} ${product.description || ""}`.toLowerCase();
  return words.every((w) => text.includes(w));
};

const NavSearch = () => {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const listId = useId();

  const [open, setOpen] = useState(false); // narrow screens: panel shown
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState("");
  const [products, setProducts] = useState(productsCache || []);
  const [active, setActive] = useState(-1); // highlighted suggestion (keyboard)
  const [scope, setScope] = useState("All"); // category picked next to the box
  const [categories, setCategories] = useState(categoriesCache || []);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  // Load the products the first time the box is used
  const ensureProducts = () => {
    if (productsCache) return;
    api
      .get("/products")
      .then((res) => {
        productsCache = Array.isArray(res.data) ? res.data : [];
        setProducts(productsCache);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (categoriesCache) return;
    api
      .get("/categories")
      .then((res) => {
        categoriesCache = Array.isArray(res.data) ? res.data : [];
        setCategories(categoriesCache);
      })
      .catch(() => {});
  }, []);

  // Close when the page changes; show the current search (and category) on the shop page
  useEffect(() => {
    setOpen(false);
    setFocused(false);
    setActive(-1);
    const params = new URLSearchParams(search);
    setText(pathname === "/shop" ? params.get("q") || "" : "");
    setScope(pathname === "/shop" ? params.get("category") || "All" : "All");
  }, [pathname, search]);

  // "/" anywhere on the page jumps to the search box (like big stores), unless you're typing
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target;
      if (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (!inputRef.current?.offsetParent) return; // box hidden (phones)
      e.preventDefault();
      inputRef.current.focus(); // focusing loads the products
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Click outside closes the suggestions
  useEffect(() => {
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setFocused(false);
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const words = useMemo(() => text.trim().toLowerCase().split(/\s+/).filter(Boolean), [text]);
  const results = useMemo(
    () =>
      words.length
        ? products.filter((p) => (scope === "All" || p.category_name === scope) && matches(p, words))
        : [],
    [products, words, scope]
  );
  const shown = results.slice(0, MAX_SUGGESTIONS);
  const showList = focused && words.length > 0;

  const goToResults = () => {
    const params = new URLSearchParams();
    if (scope !== "All") params.set("category", scope);
    if (text.trim()) params.set("q", text.trim());
    navigate(params.toString() ? `/shop?${params}` : "/shop");
  };

  const openProduct = (p) => navigate(productPath(p));

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, shown.length)); // last row = "See all results"
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setFocused(false);
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (active >= 0 && active < shown.length) openProduct(shown[active]);
    else goToResults();
  };

  return (
    <div className={`ns ${open ? "is-open" : ""}`} ref={wrapRef}>
      <button
        type="button"
        className="nb-icon-btn ns-toggle"
        onClick={() => {
          setOpen((v) => !v);
          ensureProducts();
          setTimeout(() => inputRef.current?.focus(), 30);
        }}
        aria-label={open ? "Close search" : "Search products"}
        aria-expanded={open}
      >
        {open ? <CloseIcon /> : <SearchIcon />}
      </button>

      <form className="ns-form" role="search" onSubmit={onSubmit}>
        <label className="ns-scope">
          <span className="ns-scope__label">{scope === "All" ? "All" : scope}</span>
          <KeyboardArrowDownIcon fontSize="small" />
          <select
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
              setActive(-1);
              inputRef.current?.focus();
            }}
            aria-label="Search in category"
          >
            <option value="All">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <SearchIcon className="ns-icon" fontSize="small" />
        <input
          ref={inputRef}
          type="search"
          value={text}
          placeholder={scope === "All" ? "Search graphics cards, monitors, laptops…" : `Search in ${scope}…`}
          aria-label="Search products"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          onChange={(e) => {
            setText(e.target.value);
            setActive(-1);
          }}
          onFocus={() => {
            setFocused(true);
            ensureProducts();
          }}
          onKeyDown={onKeyDown}
        />
        <button type="submit" className="ns-submit" aria-label="Search">
          <SearchIcon />
        </button>

        {showList && (
          <div className="ns-panel" id={listId} role="listbox">
            {shown.length === 0 ? (
              <p className="ns-empty">No products match “{text.trim()}”.</p>
            ) : (
              shown.map((p, i) => (
                <button
                  type="button"
                  key={p.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={active === i}
                  className={`ns-item ${active === i ? "is-active" : ""}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => openProduct(p)}
                >
                  <img src={imageUrl(p.image) || FALLBACK_IMG} alt="" onError={onImageError} />
                  <span className="ns-item__text">
                    <strong>{p.name}</strong>
                    <small>{p.category_name}</small>
                  </span>
                  <span className="ns-item__price">{formatMoney(p.price)}</span>
                </button>
              ))
            )}
            <button
              type="button"
              id={`${listId}-${shown.length}`}
              role="option"
              aria-selected={active === shown.length}
              className={`ns-all ${active === shown.length ? "is-active" : ""}`}
              onMouseEnter={() => setActive(shown.length)}
              onClick={goToResults}
            >
              See all {results.length} {results.length === 1 ? "result" : "results"} for “{text.trim()}”
              {scope !== "All" && ` in ${scope}`}
              <ArrowForwardIcon fontSize="small" />
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default NavSearch;
