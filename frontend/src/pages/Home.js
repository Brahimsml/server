import React, { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import AssignmentReturnOutlinedIcon from "@mui/icons-material/AssignmentReturnOutlined";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import BannerSlide from "../Components/BannerSlide";
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

const TRUST_ITEMS = [
  // only what the shop really offers
  { icon: PaymentsOutlinedIcon, title: "Cash on delivery", text: "Pay when it arrives" },
  { icon: LocalShippingOutlinedIcon, title: "Delivery all over Lebanon", text: "Faster in Beirut" },
  { icon: AssignmentReturnOutlinedIcon, title: "7-day returns", text: "Change your mind" },
  { icon: SupportAgentOutlinedIcon, title: "Real support", text: "WhatsApp, call or visit" },
];

const shopLink = (category) =>
  category && category !== "All" ? `/shop?category=${encodeURIComponent(category)}` : "/shop";

const isNew = (p) => /^new/i.test(normalizeLabel(p.label));

const ROW_SIZE = 8; // products per sideways row

// Items per row so the rows come out even: 12 with at most 10 a row → 6 + 6, not 10 + 2
const perRow = (count, max) => Math.ceil(count / Math.ceil(count / max)) || 1;

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
  const categories = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      const name = p.category_name || "Other";
      if (!map.has(name)) map.set(name, { name, order: p.category_order, chosen: p.category_image, count: 0, image: "", pick: null });
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
  }, [products]);

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
      .map((p) => (
        <section key={`promo-${p.id}`} className={`mt-section hp-promos hp-promos--${p.layout}`} aria-label="Offers">
          {p.slots.map((slot) => (
            <div key={slot.id} className="hp-promo">
              <BannerSlide banner={slot} placeholder={false} />
            </div>
          ))}
        </section>
      ));
  return (
    <div className="mt-page hp hp-home">
      <div className="mt-container">
        {/* ===== HERO: full-width product banner ===== */}
        <h1 className="hp-sr-only">MegaTech: PC components and gaming gear</h1>

        <section
          className={`hp-slider ${paused ? "is-paused" : ""}`}
          aria-roledescription="carousel"
          aria-label="Featured products"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
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
                <img src={imageUrl(current.image)} alt="" onError={onImageError} />
              </Link>
            </div>
          ) : (
            <div className="mt-empty hp-slider__empty">
              <h3>New products coming soon</h3>
              <p>Check back shortly for the latest gear.</p>
            </div>
          )}
        </section>

        {/* ===== TRUST BAR ===== */}
        <section className="hp-trust mt-panel" aria-label="Why shop with us">
          {TRUST_ITEMS.map(({ icon: Icon, title, text }) => (
            <div className="hp-trust__item" key={title}>
              <span className="hp-trust__icon">
                <Icon />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </section>

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

        {/* ===== CATEGORIES ===== */}
        {categories.length > 0 && (
          <section className="mt-section mt-box" id="categories">
            <div className="mt-section-head">
              <div>
                <h2>Shop by category</h2>
              </div>
            </div>

            {/* Round pictures in even rows, like big electronics stores (9 → one row on computers, 5 + 4 on tablets; phones swipe) */}
            <div
              className="hp-circles"
              style={{
                "--per-row-desktop": perRow(categories.length, 10),
                "--per-row-tablet": perRow(categories.length, 5),
              }}
            >
              {categories.map((cat) => (
                <Link key={cat.name} to={shopLink(cat.name)} className="hp-circle">
                  <span className="hp-circle__pic">
                    {cat.image && <img src={imageUrl(cat.image)} alt="" loading="lazy" onError={onImageError} />}
                  </span>
                  <span className="hp-circle__name">{cat.name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {promosAt("after_categories")}

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
          <h2 id="hp-help-title" className="hp-help__title">Need help choosing?</h2>

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

        {/* ===== CLOSING CTA ===== */}
        <section className="mt-cta">
          <div>
            <h2>Prefer to see it in person?</h2>
            <p>Visit one of our stores, or ask our team anything about your next build.</p>
          </div>
          <div className="mt-cta__actions">
            <Link to="/menu" className="mt-btn mt-btn--primary">
              Find a store
            </Link>
            <Link to="/contact" className="mt-btn mt-btn--secondary">
              Contact us
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Home;
