import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import api from "../api";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import { byCategoryOrder, formatMoney, imageUrl, isBestSeller, onImageError, productPath, FALLBACK_IMG } from "../utils/shop";

/*
  Search box in the menu bar, with live suggestions.
  - wide screens: always visible in the bar
  - narrow screens: a search icon opens it under the bar
  Enter (or "See all results") opens the shop filtered by the words typed.
*/
const MAX_SUGGESTIONS = 6;

let productsCache = null; // loaded once, the first time someone uses the search

const MAX_LINKS = 3; // categories / brands shown above the products

const matches = (product, words) => {
  const text = `${product.name || ""} ${product.brand || ""} ${product.category_name || ""} ${product.description || ""}`.toLowerCase();
  return words.every((w) => text.includes(w));
};

// Most likely first: name starts with what was typed, then all words in the name, then best sellers
const score = (product, words) => {
  const name = String(product.name || "").toLowerCase();
  let points = 0;
  if (name.startsWith(words[0])) points += 4;
  if (words.every((w) => name.includes(w))) points += 2;
  if (isBestSeller(product)) points += 1;
  return points;
};

// The typed words in bold inside a name
const highlight = (text, words) => {
  if (!words.length) return text;
  const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return String(text)
    .split(pattern)
    .map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part));
};

const shopLink = (category) => `/shop?category=${encodeURIComponent(category)}`;

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
    () =>
      words.length
        ? products
            .filter((p) => matches(p, words))
            .sort((a, b) => score(b, words) - score(a, words))
        : [],
    [products, words]
  );

  // Categories and brands whose name matches, with how many products they have
  const groups = useMemo(() => {
    if (!words.length) return [];
    const q = words.join(" ");
    const count = (key) => {
      const map = new Map();
      products.forEach((p) => {
        const name = String(p[key] || "").trim();
        if (name) map.set(name, { name, order: p.category_order, count: (map.get(name)?.count || 0) + 1 });
      });
      return [...map.values()].filter((g) => g.name.toLowerCase().includes(q));
    };
    const cats = count("category_name")
      .sort(byCategoryOrder)
      .map((g) => ({ ...g, type: "category", to: shopLink(g.name) }));
    const brands = count("brand").map((g) => ({ ...g, type: "brand", to: `/shop?q=${encodeURIComponent(g.name)}` }));
    return [...cats, ...brands].slice(0, MAX_LINKS);
  }, [products, words]);

  // Empty box: popular categories and a few best sellers to start from
  const popular = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      const name = p.category_name || "Other";
      if (!map.has(name)) map.set(name, { name, order: p.category_order, count: 0 });
      map.get(name).count += 1;
    });
    return {
      categories: [...map.values()].sort(byCategoryOrder).slice(0, 6),
      products: products.filter((p) => isBestSeller(p) && p.image).sort((a, b) => Number(b.price) - Number(a.price)).slice(0, 3),
    };
  }, [products]);

  const shown = words.length ? results.slice(0, MAX_SUGGESTIONS) : popular.products;
  // keyboard order: category/brand links, then products, then "See all"
  const links = words.length ? groups : [];
  const total = links.length + shown.length;
  const showList = focused && (words.length > 0 || products.length > 0);

  const goToResults = () => {
    const q = text.trim();
    navigate(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
  };

  const openProduct = (p) => navigate(productPath(p));

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, words.length ? total : total - 1)); // last row = "See all results"
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
    if (active >= 0 && active < links.length) navigate(links[active].to);
    else if (active >= links.length && active < total) openProduct(shown[active - links.length]);
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
            {/* empty box: quick ways in */}
            {!words.length && popular.categories.length > 0 && (
              <div className="ns-group">
                <p className="ns-group__title">Popular categories</p>
                <div className="ns-chips">
                  {popular.categories.map((c) => (
                    <button type="button" key={c.name} className="ns-chip" onClick={() => navigate(shopLink(c.name))}>
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* typing: matching categories and brands first */}
            {links.map((g, i) => (
              <button
                type="button"
                key={`${g.type}-${g.name}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={active === i}
                className={`ns-link ${active === i ? "is-active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => navigate(g.to)}
              >
                <span className="ns-link__icon">{g.type === "brand" ? <SellOutlinedIcon /> : <CategoryOutlinedIcon />}</span>
                <span className="ns-item__text">
                  <strong>{highlight(g.name, words)}</strong>
                  <small>
                    {g.type === "brand" ? "Brand" : "Category"} · {g.count} {g.count === 1 ? "product" : "products"}
                  </small>
                </span>
                <ArrowForwardIcon className="ns-link__go" fontSize="small" />
              </button>
            ))}

            {!words.length && shown.length > 0 && <p className="ns-group__title ns-group__title--products">Best sellers</p>}

            {words.length > 0 && shown.length === 0 && links.length === 0 ? (
              <p className="ns-empty">No products match “{text.trim()}”.</p>
            ) : (
              shown.map((p, j) => {
                const i = links.length + j;
                return (
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
                      <strong>{highlight(p.name, words)}</strong>
                      <small>{p.category_name}</small>
                    </span>
                    <span className="ns-item__price">{formatMoney(p.price)}</span>
                  </button>
                );
              })
            )}

            {words.length > 0 && (
              <button
                type="button"
                id={`${listId}-${total}`}
                role="option"
                aria-selected={active === total}
                className={`ns-all ${active === total ? "is-active" : ""}`}
                onMouseEnter={() => setActive(total)}
                onClick={goToResults}
              >
                See all {results.length} {results.length === 1 ? "result" : "results"} for “{text.trim()}”
                <ArrowForwardIcon fontSize="small" />
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
};

export default NavSearch;
