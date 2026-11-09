import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import BannerSlide from "../Components/BannerSlide";
import PromoRow from "../Components/PromoRow";
import ModernHome from "../Components/ModernHome";
import { CategoryCircles, EdgeBanner } from "../Components/HomeTop";
import { useModernLook } from "../utils/look";
import ProductsItem from "../Components/ProductsItem";
import SHOP_INFO from "../utils/shopInfo";
import { clearRecentlyViewed, getRecentlyViewed } from "../utils/recentlyViewed";
import api from "../api";
import {
  imageUrl,
  isBestSeller,
  isSoldOut,
  normalizeLabel,
  onImageError,
  productPath,
  whatsappLink,
  byCategoryOrder,
  imageSrcSet,
  saleOf,
} from "../utils/shop";
import "../Styles/theme.css";
import "../Styles/HomePage.css";

const FEATURE_INTERVAL_MS = 6000;

// Top banner: a short campaign line per category (like big stores), not a product listing
const CATEGORY_HEADLINES = [
  [/gpu|graphic/i, "Next-gen graphics power", "The latest GPUs for smooth 4K gaming and faster creative work."],
  [/laptop/i, "Performance that travels", "Gaming and creator laptops, ready wherever you are."],
  [/monitor/i, "See every frame", "Fast, sharp gaming monitors for every setup."],
  [/mouse|mice/i, "Precision in every click", "Gaming mice built for speed, accuracy and long sessions."],
  [/headset|headphone/i, "Hear every footstep", "Wireless and wired gaming headsets for PC and console."],
  [/keyboard/i, "Every keystroke counts", "Mechanical keyboards built for gaming and everyday work."],
  [/console|playstation|xbox/i, "Next-gen gaming starts here", "The latest consoles with 4K, 120 FPS and fast SSD loading."],
  [/chair/i, "Built for long sessions", "Gaming chairs with real support for work and play."],
  [/peripheral|keyboard|mouse|headset|audio/i, "Gear up your setup", "Keyboards, mice and headsets built for play."],
];

const categoryHeadline = (name) => {
  const match = CATEGORY_HEADLINES.find(([re]) => re.test(name || ""));
  return match ? { title: match[1], text: match[2] } : { title: `Shop ${name || "the latest gear"}`, text: "Explore the latest PC gear at MegaTech." };
};

const shopLink = (category) =>
  category && category !== "All" ? `/shop?category=${encodeURIComponent(category)}` : "/shop";

const isNew = (p) => /^new/i.test(normalizeLabel(p.label));

const ROW_SIZE = 8; // products per sideways row

const Home = () => {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Products this visitor opened lately (newest first), saved in this browser
  const [recentIds, setRecentIds] = useState(getRecentlyViewed);
  const recentRank = useMemo(() => {
    const order = new Map(recentIds.map((id, i) => [id, recentIds.length - i]));
    return (p) => order.get(p.id) || 0;
  }, [recentIds]);
  const isRecent = useCallback((p) => recentIds.includes(p.id), [recentIds]);
  const hasRecent = !loading && products.some(isRecent);

  const helpWhatsapp = whatsappLink(SHOP_INFO.phone, "Hi MegaTech, I need help choosing a product.");

  // Modern look preview (Components/ModernHome.js + Styles/ModernPreview.css)
  const modern = useModernLook();

  // Banners made in Admin → Banners. While any are live they replace the category slides.
  const [banners, setBanners] = useState([]);
  useEffect(() => {
    api
      .get("/banners")
      .then((res) => setBanners(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  // Promo sections (Admin → Banners → Promo sections): rows of 1-3 banners between the sections
  const [promos, setPromos] = useState([]);
  useEffect(() => {
    api
      .get("/promos")
      .then((res) => setPromos(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  const [featureIndex, setFeatureIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // phones: swipe the top banner left / right to change it (like shopping apps)
  const swipeStart = useRef(null);

  // Load the catalog once and share it with every section
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

  // Banner: one slide per category, showing its flagship: the priciest
  // Best Seller / New product with a photo (or the priciest one if none is labelled)
  const featured = useMemo(() => {
    const byCategory = new Map();
    products
      .filter((p) => p.image && !isSoldOut(p))
      .sort((a, b) => Number(Boolean(normalizeLabel(b.label))) - Number(Boolean(normalizeLabel(a.label))) || Number(b.price) - Number(a.price))
      .forEach((p) => {
        const name = p.category_name || "Other";
        if (!byCategory.has(name)) byCategory.set(name, p);
      });
    return Array.from(byCategory.values())
      .sort((a, b) => byCategoryOrder({ ...a, name: a.category_name, order: a.category_order }, { ...b, name: b.category_name, order: b.category_order }))
      .slice(0, 6);
  }, [products]);

  const slideCount = banners.length || featured.length;

  // Next slide after a few seconds. Restarts on every change, so a click or a
  // pause always gives the new slide its full time (matching the progress bar).
  useEffect(() => {
    if (slideCount < 2 || paused) return;
    const timer = setTimeout(
      () => setFeatureIndex((i) => (i + 1) % slideCount),
      FEATURE_INTERVAL_MS
    );
    return () => clearTimeout(timer);
  }, [slideCount, paused, featureIndex]);

  const current = featured[featureIndex % (featured.length || 1)];
  const currentBanner = banners.length ? banners[featureIndex % banners.length] : null;

  // Category tiles: photo of the category's flagship (most expensive) product that isn't
  // already in the Best sellers row, so tiles show real hero products and don't repeat that row
  // One entry per category (byGroup: per main entry, a group taking its categories' products),
  // with its count and picture: the one chosen in Admin → Categories, else its top product's photo
  const summarize = (byGroup) => {
    const map = new Map();
    products.forEach((p) => {
      const group = byGroup && p.category_parent;
      const name = group ? p.category_parent : p.category_name || "Other";
      if (!map.has(name))
        map.set(name, {
          name,
          order: group ? p.category_parent_order : p.category_order,
          chosen: group ? p.category_parent_image : p.category_image,
          // how the picture sits in its circle (Admin → Categories → crop tool)
          frame: group
            ? { zoom: p.category_parent_pic_zoom ?? 100, x: p.category_parent_pic_x ?? 50, y: p.category_parent_pic_y ?? 50, fill: p.category_parent_pic_fill || "dark" }
            : { zoom: p.category_pic_zoom ?? 100, x: p.category_pic_x ?? 50, y: p.category_pic_y ?? 50, fill: p.category_pic_fill || "dark" },
          count: 0,
          image: "",
          pick: null,
        });
      const entry = map.get(name);
      entry.count += 1;
      if (!p.image) return;
      const better =
        !entry.pick ||
        (isBestSeller(entry.pick) && !isBestSeller(p)) ||
        (isBestSeller(entry.pick) === isBestSeller(p) && Number(p.price) > Number(entry.pick.price));
      if (better) {
        entry.pick = p;
        entry.image = p.image;
      }
    });
    // a picture chosen in Admin → Categories wins over the automatic one
    return Array.from(map.values())
      .map((c) => (c.chosen ? { ...c, image: c.chosen } : c))
      .sort(byCategoryOrder);
  };
  // every category (the product rows further down)
  const categories = useMemo(() => summarize(false), [products]); // eslint-disable-line react-hooks/exhaustive-deps
  // "Shop by category" tiles: the main entries, so groups show as one tile (like big stores)
  const circles = useMemo(() => summarize(true), [products]); // eslint-disable-line react-hooks/exhaustive-deps

  // New arrivals: products labelled "New", topped up with the newest products
  // that aren't already in Best sellers, so the two rows don't repeat each other
  const newArrivalIds = useMemo(() => {
    const newest = [...products].sort((a, b) => Number(b.id) - Number(a.id));
    const picks = newest.filter(isNew);
    newest.forEach((p) => {
      if (picks.length < ROW_SIZE && !picks.includes(p) && !isBestSeller(p)) picks.push(p);
    });
    return new Set(picks.slice(0, ROW_SIZE).map((p) => p.id));
  }, [products]);

  // Category rows show products that aren't already in Best sellers / New arrivals
  // first, so the home page doesn't keep repeating the same ones
  const shownAbove = useMemo(() => {
    const best = [...products]
      .filter(isBestSeller)
      .sort((a, b) => Number(b.id) - Number(a.id))
      .slice(0, ROW_SIZE)
      .map((p) => p.id);
    return new Set([...best, ...newArrivalIds]);
  }, [products, newArrivalIds]);

  const notShownAbove = useCallback((p) => !shownAbove.has(p.id), [shownAbove]);

  // Old links (/home?category=Monitors) now open the shop page
  const { search } = useLocation();
  useEffect(() => {
    const requested = new URLSearchParams(search).get("category");
    if (requested) navigate(shopLink(requested), { replace: true });
  }, [search, navigate]);

  const step = (dir) => {
    if (!slideCount) return;
    setFeatureIndex((i) => (i + dir + slideCount) % slideCount);
  };

  const controls =
    slideCount > 1 && (
      <div className="hp-slider__controls">
        <button
          type="button"
          className="hp-slider__arrow"
          onClick={() => step(-1)}
          aria-label="Previous banner"
        >
          <ChevronLeftIcon />
        </button>
        <div className="hp-slider__dots" role="tablist" aria-label="Banners">
          {(banners.length ? banners : featured).map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={i === featureIndex}
              aria-label={`Show ${p.title || p.category_name}`}
              className={i === featureIndex ? "is-active" : ""}
              onClick={() => setFeatureIndex(i)}
            >
              <span />
            </button>
          ))}
        </div>
        <button
          type="button"
          className="hp-slider__arrow"
          onClick={() => step(1)}
          aria-label="Next banner"
        >
          <ChevronRightIcon />
        </button>
      </div>
    );


  // Promo sections at one spot of the page. One placed after a category row that isn't
  // showing (too few products) moves to the bottom instead of disappearing.
  const shownRows = loading ? null : new Set(categories.filter((c) => c.count >= 2).map((c) => c.name));
  const spotOf = (p) => (p.position.startsWith("cat:") && shownRows && !shownRows.has(p.position.slice(4)) ? "bottom" : p.position);
  const promosAt = (spot) =>
    promos
      .filter((p) => spotOf(p) === spot)
      .map((p) => <PromoRow key={`promo-${p.id}`} promo={p} />);
  const promosWhere = (test) =>
    promos.filter((p) => test(spotOf(p))).map((p) => <PromoRow key={`promo-${p.id}`} promo={p} />);

  if (modern) {
    return (
      <ModernHome
        products={products}
        loading={loading}
        loadError={loadError}
        banners={banners}
        bannerIndex={featureIndex}
        onBanner={setFeatureIndex}
        circles={circles}
        categories={categories}
        newArrivalIds={newArrivalIds}
        recent={{
          has: hasRecent,
          is: isRecent,
          rank: recentRank,
          clear: () => {
            clearRecentlyViewed();
            setRecentIds([]);
          },
        }}
        promosAt={promosAt}
        promosWhere={promosWhere}
      />
    );
  }

  return (
    <div className={`mt-page hp hp-home ${banners.length ? "hp-home--edge" : ""}`}>
      <div className="mt-container">
        {/* ===== HERO: full-width product banner ===== */}
        <h1 className="hp-sr-only">MegaTech: PC components and gaming gear</h1>

        {/* Banners from Admin → Banners: edge to edge with small dots (Components/HomeTop.js).
            Without any, the old slides of each category's top product. */}
        {banners.length ? (
          <EdgeBanner banners={banners} index={featureIndex} onIndex={setFeatureIndex} />
        ) : (
          <section
            className={`hp-slider ${paused ? "is-paused" : ""}`}
            aria-roledescription="carousel"
            aria-label="Featured products"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            onTouchStart={(e) => (swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
            onTouchEnd={(e) => {
              const start = swipeStart.current;
              swipeStart.current = null;
              if (!start || slideCount < 2) return;
              const dx = e.changedTouches[0].clientX - start.x;
              const dy = e.changedTouches[0].clientY - start.y;
              if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
            }}
          >
            {currentBanner ? (
              <BannerSlide key={`banner-${currentBanner.id}`} banner={currentBanner}>
                {controls}
              </BannerSlide>
            ) : loading ? (
              <div className="mt-skeleton hp-slider__skeleton" />
            ) : current ? (
              <div className="hp-slide" key={current.id}>
                <div className="hp-slide__copy">
                  <span className="hp-slide__cat">{current.category_name}</span>

                  <h2 className="hp-slide__title">{categoryHeadline(current.category_name).title}</h2>
                  <p className="hp-slide__desc">{categoryHeadline(current.category_name).text}</p>

                  <div className="hp-slide__actions">
                    <Link to={shopLink(current.category_name)} className="mt-btn mt-btn--primary">
                      Shop now <ArrowForwardIcon />
                    </Link>
                    <Link to={productPath(current)} className="hp-slide__featuring">
                      Featuring {current.name}
                    </Link>
                  </div>

                  {controls}
                </div>

                <Link to={productPath(current)} className="hp-slide__media" tabIndex={-1} aria-hidden="true">
                  <img src={imageUrl(current.image)} srcSet={imageSrcSet(current.image)} sizes="(max-width: 860px) 90vw, 600px" alt="" onError={onImageError} />
                </Link>
              </div>
            ) : (
              <div className="mt-empty hp-slider__empty">
                <h3>New products coming soon</h3>
                <p>Check back shortly for the latest gear.</p>
              </div>
            )}
          </section>
        )}

        {promosAt("after_trust")}

        {/* ===== RECENTLY VIEWED (only for visitors who opened products before) ===== */}
        {hasRecent && (
          <section className="mt-section mt-box hp-recent" id="recently-viewed">
            <div className="mt-section-head">
              <div>
                <h2>Recently viewed</h2>
              </div>
              <button
                type="button"
                className="mt-link hp-recent__clear"
                onClick={() => {
                  clearRecentlyViewed();
                  setRecentIds([]);
                }}
              >
                Clear history
              </button>
            </div>

            <ProductsItem
              products={products}
              filter={isRecent}
              rank={recentRank}
              limit={12}
              row
              showToolbar={false}
              showCategories={false}
              showPagination={false}
            />
          </section>
        )}

        {loadError && (
          <div className="mt-alert mt-alert--error hp-error" role="alert">
            We couldn't load products right now. Please refresh the page in a moment.
          </div>
        )}

        {/* ===== CATEGORIES: round photos in one row (Components/HomeTop.js) ===== */}
        <CategoryCircles circles={circles} productCount={products.length} className="hp-tiles" />

        {promosAt("after_categories")}

        {/* ===== DEALS (products with an old price, Admin → Products) ===== */}
        {!loading && products.some((p) => saleOf(p)) && (
          <section className="mt-section mt-box hp-deals" id="deals">
            <div className="mt-section-head">
              <div>
                <h2>
                  Deals <span className="hp-deals__tag">Save up to {Math.max(...products.map((p) => saleOf(p)?.percent || 0))}%</span>
                </h2>
              </div>
              <Link to="/shop?sale=1" className="mt-link">
                See all deals <ArrowForwardIcon fontSize="inherit" />
              </Link>
            </div>

            <ProductsItem
              products={products}
              filter={(p) => !!saleOf(p)}
              limit={ROW_SIZE}
              row
              showToolbar={false}
              showCategories={false}
              showPagination={false}
            />
          </section>
        )}

        {/* ===== BEST SELLERS ===== */}
        {(loading || products.some(isBestSeller)) && (
          <section className="mt-section mt-box" id="best-sellers">
            <div className="mt-section-head">
              <div>
                <h2>Best sellers</h2>
              </div>
              <Link to="/shop" className="mt-link">
                View all products <ArrowForwardIcon fontSize="inherit" />
              </Link>
            </div>

            <ProductsItem
              products={products}
              loading={loading}
              filter={isBestSeller}
              limit={ROW_SIZE}
              row
              showToolbar={false}
              showCategories={false}
              showPagination={false}
            />
          </section>
        )}

        {promosAt("after_best")}

        {/* ===== NEW ARRIVALS ===== */}
        {(loading || newArrivalIds.size > 0) && (
          <section className="mt-section mt-box" id="new-arrivals">
            <div className="mt-section-head">
              <div>
                <h2>New arrivals</h2>
              </div>
              <Link to="/shop" className="mt-link">
                Shop everything <ArrowForwardIcon fontSize="inherit" />
              </Link>
            </div>

            <ProductsItem
              products={products}
              loading={loading}
              filter={(p) => newArrivalIds.has(p.id)}
              limit={ROW_SIZE}
              row
              showToolbar={false}
              showCategories={false}
              showPagination={false}
            />
          </section>
        )}

        {promosAt("after_new")}

        {/* ===== NEED HELP CHOOSING? ===== */}
        <section className="mt-section hp-help" aria-labelledby="hp-help-title">
          <div className="hp-help__text">
            <span className="hp-help__eyebrow">Real people, quick answers</span>
            <h2 id="hp-help-title" className="hp-help__title">Need help choosing?</h2>
            <p className="hp-help__sub">Message us, chat here, or come try it in a store.</p>
          </div>

          <div className="hp-help__options">
            {helpWhatsapp && (
              <a className="hp-help__option" href={helpWhatsapp} target="_blank" rel="noopener noreferrer">
                <span className="hp-help__icon hp-help__icon--wa">
                  <WhatsAppIcon />
                </span>
                <strong>WhatsApp</strong>
                <ArrowForwardIcon className="hp-help__arrow" />
              </a>
            )}
            <button
              type="button"
              className="hp-help__option"
              onClick={() => window.dispatchEvent(new Event("megatech:open-chat"))}
            >
              <span className="hp-help__icon">
                <ChatBubbleOutlineIcon />
              </span>
              <strong>Chat now</strong>
              <ArrowForwardIcon className="hp-help__arrow" />
            </button>
            <Link className="hp-help__option" to="/menu">
              <span className="hp-help__icon">
                <StorefrontOutlinedIcon />
              </span>
              <strong>Visit a store</strong>
              <ArrowForwardIcon className="hp-help__arrow" />
            </Link>
          </div>
        </section>

        {/* ===== ONE ROW PER CATEGORY ===== */}
        {!loading &&
          categories
            .filter((cat) => cat.count >= 2)
            .map((cat) => (
              <Fragment key={cat.name}>
                <section className="mt-section mt-box hp-catrow">
                  <div className="mt-section-head">
                    <div>
                      <h2>{cat.name}</h2>
                    </div>
                    <Link to={shopLink(cat.name)} className="mt-link">
                      See all {cat.count} <ArrowForwardIcon fontSize="inherit" />
                    </Link>
                  </div>

                  <ProductsItem
                    products={products}
                    category={cat.name}
                    rank={notShownAbove}
                    limit={ROW_SIZE}
                    row
                    showToolbar={false}
                    showCategories={false}
                    showPagination={false}
                  />
                </section>
                {promosAt(`cat:${cat.name}`)}
              </Fragment>
            ))}

        {promosAt("bottom")}
      </div>
    </div>
  );
};

export default Home;
