import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import api from "../api";
import { formatMoney, imageUrl, onImageError, productPath, FALLBACK_IMG } from "../utils/shop";

/*
  Search box in the menu bar, with live suggestions.
  - wide screens: always visible in the bar
  - narrow screens: a search icon opens it under the bar
  Enter (or "See all results") opens the shop filtered by the words typed.
*/
const MAX_SUGGESTIONS = 6;

let productsCache = null; // loaded once, the first time someone uses the search

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

  // Close when the page changes; show the current search on the shop page
  useEffect(() => {
    setOpen(false);
    setFocused(false);
    setActive(-1);
    setText(pathname === "/shop" ? new URLSearchParams(search).get("q") || "" : "");
  }, [pathname, search]);

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
    () => (words.length ? products.filter((p) => matches(p, words)) : []),
    [products, words]
  );
  const shown = results.slice(0, MAX_SUGGESTIONS);
  const showList = focused && words.length > 0;

  const goToResults = () => {
    const q = text.trim();
    navigate(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
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
        <SearchIcon className="ns-icon" fontSize="small" />
        <input
          ref={inputRef}
          type="search"
          value={text}
          placeholder="Search products"
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
              <ArrowForwardIcon fontSize="small" />
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default NavSearch;
