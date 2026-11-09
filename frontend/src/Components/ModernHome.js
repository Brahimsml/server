import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { CategoryTiles, EdgeBanner, Reveal } from "./HomeTop";
import ProductsItem from "./ProductsItem";
import { formatMoney, imageSrcSet, imageUrl, isBestSeller, isSoldOut, onImageError, productPath, saleOf } from "../utils/shop";

/*
  MODERN LOOK: PREVIEW ONLY (/home?look=modern, see Styles/ModernPreview.css)
  Same data as the normal home page (pages/Home.js passes it in), laid out like a 2026 store:
    banner edge to edge · equal category tiles · "This week" bento grid (spotlight,
    deals, 2 products) · one product row with tabs (Deals / Best sellers / Just arrived, without
    the products already in "This week") · numbers strip · brands moving across · footer
  Black and white only (sales stay red); sections fade in gently as you scroll.
*/
const ROW_SIZE = 10;
const rowProps = { row: true, showToolbar: false, showCategories: false, showPagination: false, limit: ROW_SIZE };
const withPhoto = (p) => p.image && !isSoldOut(p);
const priciest = (list) => [...list].sort((a, b) => Number(b.price) - Number(a.price))[0] || null;

// Brands on the products (Admin → Products → Brand), most products first
const brandList = (products) => {
  const count = new Map();
  products.forEach((p) => {
    const b = String(p.brand || "").trim();
    if (b) count.set(b, (count.get(b) || 0) + 1);
  });
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name).slice(0, 12);
};

// Product rows: a thin line under each row shows how far it's scrolled
// (CSS reads --row-pos and --row-size on the row's box)
const useRowProgress = (deps) => {
  useEffect(() => {
    const rows = [...document.querySelectorAll(".mh .pc-grid--row")];
    const update = (el) => {
      const max = el.scrollWidth - el.clientWidth;
      const box = el.parentElement;
      box.style.setProperty("--row-size", String(el.scrollWidth ? el.clientWidth / el.scrollWidth : 1));
      box.style.setProperty("--row-pos", String(max > 0 ? el.scrollLeft / max : 0));
      box.classList.toggle("has-more", max > 4);
    };
    const handlers = rows.map((el) => {
      const fn = () => update(el);
      el.addEventListener("scroll", fn, { passive: true });
      update(el);
      return [el, fn];
    });
    const onResize = () => rows.forEach(update);
    window.addEventListener("resize", onResize);
    return () => {
      handlers.forEach(([el, fn]) => el.removeEventListener("scroll", fn));
      window.removeEventListener("resize", onResize);
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
};

/* A product tile in the bento grid: photo on light grey, small label, name, price */
const ProductTile = ({ product, label }) => {
  const sale = saleOf(product);
  return (
    <Link to={productPath(product)} className="mh-b mh-b--item">
      <span className="mh-b__label">{label}</span>
      <span className="mh-b__photo">
        <img src={imageUrl(product.image)} srcSet={imageSrcSet(product.image, 800)} sizes="(max-width: 900px) 50vw, 25vw" alt="" loading="lazy" onError={onImageError} />
      </span>
      <span className="mh-b__name">{product.name}</span>
      <span className="mh-b__price">
        {formatMoney(product.price)}
        {sale && <s>{formatMoney(sale.old)}</s>}
      </span>
    </Link>
  );
};

const TABS = [
  { id: "deals", label: "Deals", link: "/shop?sale=1", linkText: "See all deals" },
  { id: "best", label: "Best sellers", link: "/shop", linkText: "View all" },
  { id: "new", label: "Just arrived", link: "/shop", linkText: "Shop everything" },
];

const ModernHome = ({ products, loading, loadError, banners, bannerIndex, onBanner, circles, categories, newArrivalIds, recent, promosAt, promosWhere }) => {
  const onSale = useMemo(() => products.filter((p) => saleOf(p)), [products]);
  const bestOff = onSale.length ? Math.max(...onSale.map((p) => saleOf(p).percent)) : 0;

  // Tabs: only the ones that have products; the first one is open
  const tabs = TABS.filter((t) =>
    t.id === "deals" ? onSale.length > 0 : t.id === "best" ? products.some(isBestSeller) : newArrivalIds.size > 0
  );
  const [tab, setTab] = useState(null);
  const current = tabs.find((t) => t.id === tab) || tabs[0];
  const tabFilter = !current
    ? () => false
    : current.id === "deals"
    ? (p) => !!saleOf(p)
    : current.id === "best"
    ? isBestSeller
    : (p) => newArrivalIds.has(p.id);

  // "This week" bento: the priciest best seller big, a deals tile, the newest product and another best seller
  const bento = useMemo(() => {
    const ok = products.filter(withPhoto);
    const hero = priciest(ok.filter(isBestSeller)) || priciest(ok);
    const used = new Set(hero ? [hero.id] : []);
    const newest = ok.filter((p) => newArrivalIds.has(p.id) && !used.has(p.id)).sort((a, b) => b.id - a.id)[0] || null;
    if (newest) used.add(newest.id);
    const best = ok.filter((p) => isBestSeller(p) && !used.has(p.id)).sort((a, b) => b.id - a.id)[0] || ok.find((p) => !used.has(p.id)) || null;
    // the tabs row below doesn't show these again
    const shown = new Set([hero, newest, best].filter(Boolean).map((p) => p.id));
    return { hero, newest, best, shown };
  }, [products, newArrivalIds]);

  const brands = useMemo(() => brandList(products), [products]);
  // the moving brand line: the names repeated until it's long enough, then twice (for a seamless loop)
  const marquee = useMemo(() => {
    if (brands.length < 3) return [];
    const list = [];
    while (list.length < 14) list.push(...brands);
    return list;
  }, [brands]);

  useRowProgress([products, loading, recent.has, current?.id]);

  const stats = [
    { big: products.length, small: "products" },
    { big: categories.length, small: "categories" },
    { big: "7 days", small: "to return anything" },
    { big: "Cash", small: "on delivery, all over Lebanon" },
  ];

  return (
    <div className="mt-page hp hp-home mh">
      <div className="mt-container">
        <h1 className="hp-sr-only">MegaTech: PC components and gaming gear</h1>

        {/* ===== 1. Banner on top, edge to edge (Admin → Banners) ===== */}
        <EdgeBanner banners={banners} index={bannerIndex} onIndex={onBanner} />

        {/* ===== 2. Categories: equal tiles, all visible ===== */}
        <CategoryTiles circles={circles} productCount={products.length} categoryCount={categories.length} />

        {promosAt("after_trust")}
        {promosAt("after_categories")}

        {loadError && (
          <div className="mt-alert mt-alert--error hp-error" role="alert">
            We couldn't load products right now. Please refresh the page in a moment.
          </div>
        )}

        {/* ===== 3. This week: bento grid ===== */}
        {!loading && bento.hero && (
          <Reveal className="mh-section">
            <div className="mh-head">
              <h2>This week at MegaTech</h2>
            </div>
            <div className="mh-grid">
              <Link to={productPath(bento.hero)} className="mh-b mh-b--hero">
                <span className="mh-b__label">
                  {isBestSeller(bento.hero) ? "Best seller" : "Spotlight"} · {bento.hero.category_name}
                </span>
                <strong className="mh-b__title">{bento.hero.name}</strong>
                <span className="mh-b__price mh-b__price--big">
                  {formatMoney(bento.hero.price)}
                  {saleOf(bento.hero) && <s>{formatMoney(saleOf(bento.hero).old)}</s>}
                </span>
                <span className="mh-b__photo mh-b__photo--hero">
                  <img
                    src={imageUrl(bento.hero.image)}
                    srcSet={imageSrcSet(bento.hero.image, 1600)}
                    sizes="(max-width: 900px) 100vw, 50vw"
                    alt=""
                    loading="lazy"
                    onError={onImageError}
                  />
                </span>
                <span className="mh-b__pill">
                  Shop now <ArrowForwardIcon fontSize="inherit" />
                </span>
              </Link>

              {onSale.length > 0 ? (
                <Link to="/shop?sale=1" className="mh-b mh-b--deals">
                  <span className="mh-b__label">Deals</span>
                  <strong className="mh-b__off">
                    Up to <em>{bestOff}%</em> off
                  </strong>
                  <span className="mh-b__sub">
                    {onSale.length} {onSale.length === 1 ? "product" : "products"} on sale now
                  </span>
                  <span className="mh-b__pill mh-b__pill--light">
                    See all deals <ArrowForwardIcon fontSize="inherit" />
                  </span>
                </Link>
              ) : (
                <Link to="/shop" className="mh-b mh-b--deals">
                  <span className="mh-b__label">Shop</span>
                  <strong className="mh-b__off">Everything in one place</strong>
                  <span className="mh-b__sub">{products.length} products</span>
                  <span className="mh-b__pill mh-b__pill--light">
                    Browse all <ArrowForwardIcon fontSize="inherit" />
                  </span>
                </Link>
              )}

              {bento.newest && <ProductTile product={bento.newest} label="Just in" />}
              {bento.best && <ProductTile product={bento.best} label="Best seller" />}
            </div>
          </Reveal>
        )}

        {/* ===== Recently viewed (only for visitors who opened products before) ===== */}
        {recent.has && (
          <Reveal className="mh-section">
            <div className="mh-head">
              <h2>Pick up where you left off</h2>
              <button type="button" className="mh-more mh-more--quiet" onClick={recent.clear}>
                Clear history
              </button>
            </div>
            <ProductsItem products={products} filter={recent.is} rank={recent.rank} {...rowProps} limit={12} />
          </Reveal>
        )}

        {/* ===== 4. One product row with tabs ===== */}
        {(loading || current) && (
          <Reveal className="mh-section" id="deals">
            <div className="mh-head mh-head--tabs">
              <h2>Shop the picks</h2>
              {tabs.length > 1 && (
                <div className="mh-tabs" role="tablist" aria-label="Product picks">
                  {tabs.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={current?.id === t.id}
                      className={current?.id === t.id ? "is-active" : ""}
                      onClick={() => setTab(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
              {current && (
                <Link to={current.link} className="mh-more">
                  {current.linkText} <ArrowForwardIcon fontSize="inherit" />
                </Link>
              )}
            </div>
            <ProductsItem
              key={current?.id || "loading"}
              products={products}
              loading={loading}
              filter={(p) => tabFilter(p) && !bento.shown.has(p.id)}
              {...rowProps}
            />
          </Reveal>
        )}

        {promosAt("after_best")}

        {promosAt("after_new")}

        {/* ===== 5. Numbers ===== */}
        {!loading && products.length > 0 && (
          <Reveal className="mh-stats" aria-label="Why MegaTech">
            {stats.map((s) => (
              <div key={s.small}>
                <strong>{s.big}</strong>
                <span>{s.small}</span>
              </div>
            ))}
          </Reveal>
        )}

        {/* promo sections set to sit after a category row (there are none here) and at the bottom */}
        {promosWhere((spot) => spot.startsWith("cat:") || spot === "bottom")}
      </div>

      {/* ===== 6. Brands moving across (edge to edge) ===== */}
      {marquee.length > 0 && (
        <section className="mh-marquee" aria-label="Brands we carry">
          <div className="mh-marquee__track">
            {[0, 1].map((copy) => (
              <div className="mh-marquee__set" key={copy} aria-hidden={copy === 1 ? "true" : undefined}>
                {marquee.map((b, i) => (
                  <Link key={`${b}-${i}`} to={`/shop?q=${encodeURIComponent(b)}`} tabIndex={copy === 1 || i >= brands.length ? -1 : undefined}>
                    {b}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default ModernHome;
