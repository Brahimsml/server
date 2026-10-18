import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCartOutlined";
import CheckIcon from "@mui/icons-material/Check";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import LocalMallOutlinedIcon from "@mui/icons-material/LocalMallOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ProductsItem from "../Components/ProductsItem";
import { CartContext } from "../Context/CartContext";
import api from "../api";
import {
  formatMoney,
  imageUrl,
  isBestSeller,
  isSoldOut,
  normalizeLabel,
  onImageError,
  toCartProduct,
} from "../utils/shop";
import "../Styles/theme.css";
import "../Styles/HomePage.css";

const FEATURE_INTERVAL_MS = 6000;

const CATEGORY_BLURBS = [
  [/gpu|graphic/i, "Graphics power for serious builds"],
  [/laptop/i, "Portable performance for work and play"],
  [/monitor/i, "Sharper visuals for every setup"],
  [/peripheral|keyboard|mouse|headset|audio/i, "Keyboards, mice and headsets"],
];

const categoryBlurb = (name) =>
  (CATEGORY_BLURBS.find(([re]) => re.test(name)) || [null, "Explore the range"])[1];

const TRUST_ITEMS = [
  { icon: LockOutlinedIcon, title: "Secure checkout", text: "Safe, account-based ordering" },
  { icon: LocalShippingOutlinedIcon, title: "Fast delivery", text: "Quick, tracked shipping" },
  { icon: VerifiedUserOutlinedIcon, title: "Warranty", text: "Manufacturer backed" },
  { icon: SupportAgentOutlinedIcon, title: "Support", text: "Real help, fast replies" },
];

const shopLink = (category) =>
  category && category !== "All" ? `/shop?category=${encodeURIComponent(category)}` : "/shop";

const isNew = (p) => /^new/i.test(normalizeLabel(p.label));

const Home = () => {
  const { addToCart } = useContext(CartContext);
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [storeCount, setStoreCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [featureIndex, setFeatureIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [featureAdded, setFeatureAdded] = useState(false);
  const addedTimer = useRef(null);

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

    api
      .get("/places")
      .then((res) => alive && setStoreCount(Array.isArray(res.data) ? res.data.length : null))
      .catch(() => {});

    return () => {
      alive = false;
      clearTimeout(addedTimer.current);
    };
  }, []);

  // Featured: labelled products (Best Seller / New) with a photo, else the newest ones
  const featured = useMemo(() => {
    const withImage = products.filter((p) => p.image && !isSoldOut(p));
    const labelled = withImage.filter((p) => normalizeLabel(p.label));
    return (labelled.length >= 3 ? labelled : withImage).slice(0, 6);
  }, [products]);

  useEffect(() => {
    if (featured.length < 2 || paused) return;
    const timer = setInterval(
      () => setFeatureIndex((i) => (i + 1) % featured.length),
      FEATURE_INTERVAL_MS
    );
    return () => clearInterval(timer);
  }, [featured.length, paused]);

  const current = featured[featureIndex % (featured.length || 1)];

  const categories = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      const name = p.category_name || "Other";
      if (!map.has(name)) map.set(name, { name, count: 0, image: "" });
      const entry = map.get(name);
      entry.count += 1;
      if (p.image && (!entry.image || (entry.featured && !isBestSeller(p)))) {
        entry.image = p.image;
        entry.featured = isBestSeller(p);
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [products]);

  // New arrivals: products labelled "New", topped up with the newest products
  // that aren't already in Best sellers, so the two rows don't repeat each other
  const newArrivalIds = useMemo(() => {
    const newest = [...products].sort((a, b) => Number(b.id) - Number(a.id));
    const picks = newest.filter(isNew);
    newest.forEach((p) => {
      if (picks.length < 4 && !picks.includes(p) && !isBestSeller(p)) picks.push(p);
    });
    return new Set(picks.slice(0, 4).map((p) => p.id));
  }, [products]);

  // Old links (/home?category=Monitors) now open the shop page
  const { search } = useLocation();
  useEffect(() => {
    const requested = new URLSearchParams(search).get("category");
    if (requested) navigate(shopLink(requested), { replace: true });
  }, [search, navigate]);

  const addFeatured = () => {
    if (!current) return;
    if (addToCart(toCartProduct(current))) {
      setFeatureAdded(true);
      clearTimeout(addedTimer.current);
      addedTimer.current = setTimeout(() => setFeatureAdded(false), 1600);
    }
  };

  const step = (dir) => {
    if (!featured.length) return;
    setFeatureIndex((i) => (i + dir + featured.length) % featured.length);
    setFeatureAdded(false);
  };

  return (
    <div className="mt-page hp">
      <div className="mt-container">
        {/* ===== HERO ===== */}
        <section className="hp-hero">
          <div className="hp-hero__copy">
            <span className="mt-eyebrow">PC components &amp; gaming gear</span>
            <h1 className="hp-hero__title">
              Upgrade your setup with <span>premium PC gear</span>
            </h1>
            <p className="mt-lead">
              Graphics cards, monitors, laptops and peripherals, with secure checkout and
              order tracking from your account.
            </p>

            <div className="hp-hero__actions">
              <Link to="/shop" className="mt-btn mt-btn--primary">
                Shop all products <ArrowForwardIcon />
              </Link>
              <a href="#categories" className="mt-btn mt-btn--secondary">
                Browse categories
              </a>
            </div>

            <ul className="hp-promises">
              <li>
                <StorefrontOutlinedIcon />
                {storeCount
                  ? `${storeCount} ${storeCount === 1 ? "store" : "stores"} in Lebanon`
                  : "Stores across Lebanon"}
              </li>
              <li>
                <LocalMallOutlinedIcon /> Track every order online
              </li>
              <li>
                <ChatBubbleOutlineIcon /> Real people ready to help
              </li>
            </ul>
          </div>

          <div
            className="hp-feature mt-panel"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            {loading ? (
              <div className="mt-skeleton hp-feature__skeleton" />
            ) : current ? (
              <>
                <div className="hp-feature__media">
                  {normalizeLabel(current.label) && (
                    <span className={`pc-label ${isBestSeller(current) ? "pc-label--best" : isNew(current) ? "pc-label--new" : ""}`}>
                      {isBestSeller(current) ? "Best Seller" : normalizeLabel(current.label)}
                    </span>
                  )}
                  <img
                    key={current.id}
                    src={imageUrl(current.image)}
                    alt={current.name}
                    onError={onImageError}
                  />

                  {featured.length > 1 && (
                    <>
                      <button
                        type="button"
                        className="hp-feature__arrow hp-feature__arrow--prev"
                        onClick={() => step(-1)}
                        aria-label="Previous featured product"
                      >
                        <ChevronLeftIcon />
                      </button>
                      <button
                        type="button"
                        className="hp-feature__arrow hp-feature__arrow--next"
                        onClick={() => step(1)}
                        aria-label="Next featured product"
                      >
                        <ChevronRightIcon />
                      </button>
                    </>
                  )}
                </div>

                <div className="hp-feature__body">
                  <div className="hp-feature__info">
                    <span className="pc-cat">{current.category_name}</span>
                    <h2>{current.name}</h2>
                    <p>{current.description}</p>
                  </div>

                  <div className="hp-feature__buy">
                    <span className="hp-feature__price">{formatMoney(current.price)}</span>
                    <button type="button" className="mt-btn mt-btn--primary" onClick={addFeatured}>
                      {featureAdded ? (
                        <>
                          <CheckIcon /> Added
                        </>
                      ) : (
                        <>
                          <AddShoppingCartIcon /> Add to cart
                        </>
                      )}
                    </button>
                  </div>

                  {featured.length > 1 && (
                    <div className="hp-feature__dots" role="tablist" aria-label="Featured products">
                      {featured.map((p, i) => (
                        <button
                          key={p.id}
                          type="button"
                          role="tab"
                          aria-selected={i === featureIndex}
                          aria-label={`Show ${p.name}`}
                          className={i === featureIndex ? "is-active" : ""}
                          onClick={() => {
                            setFeatureIndex(i);
                            setFeatureAdded(false);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="mt-empty">
                <h3>New products coming soon</h3>
                <p>Check back shortly for the latest gear.</p>
              </div>
            )}
          </div>
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

        {loadError && (
          <div className="mt-alert mt-alert--error hp-error" role="alert">
            We couldn't load products right now. Please refresh the page in a moment.
          </div>
        )}

        {/* ===== CATEGORIES ===== */}
        {categories.length > 0 && (
          <section className="mt-section" id="categories">
            <div className="mt-section-head">
              <div>
                <h2>Shop by category</h2>
                <p>Jump straight to the gear you're after.</p>
              </div>
            </div>

            <div className="hp-cats">
              {categories.map((cat) => (
                <Link key={cat.name} to={shopLink(cat.name)} className="hp-cat">
                  <div className="hp-cat__media">
                    {cat.image && (
                      <img src={imageUrl(cat.image)} alt="" loading="lazy" onError={onImageError} />
                    )}
                  </div>
                  <div className="hp-cat__body">
                    <h3>{cat.name}</h3>
                    <p>{categoryBlurb(cat.name)}</p>
                    <span className="hp-cat__meta">
                      {cat.count} {cat.count === 1 ? "product" : "products"}
                      <ArrowForwardIcon fontSize="inherit" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ===== BEST SELLERS ===== */}
        {(loading || products.some(isBestSeller)) && (
          <section className="mt-section" id="best-sellers">
            <div className="mt-section-head">
              <div>
                <h2>Best sellers</h2>
                <p>The gear our customers keep coming back for.</p>
              </div>
              <Link to="/shop" className="mt-link">
                View all products <ArrowForwardIcon fontSize="inherit" />
              </Link>
            </div>

            <ProductsItem
              products={products}
              loading={loading}
              filter={isBestSeller}
              limit={4}
              showToolbar={false}
              showCategories={false}
              showPagination={false}
            />
          </section>
        )}

        {/* ===== NEW ARRIVALS ===== */}
        {(loading || newArrivalIds.size > 0) && (
          <section className="mt-section" id="new-arrivals">
            <div className="mt-section-head">
              <div>
                <h2>New arrivals</h2>
                <p>The latest gear to land in the shop.</p>
              </div>
              <Link to="/shop" className="mt-link">
                Shop everything <ArrowForwardIcon fontSize="inherit" />
              </Link>
            </div>

            <ProductsItem
              products={products}
              loading={loading}
              filter={(p) => newArrivalIds.has(p.id)}
              limit={4}
              showToolbar={false}
              showCategories={false}
              showPagination={false}
            />
          </section>
        )}

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
