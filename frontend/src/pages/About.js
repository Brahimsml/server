import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import AssignmentReturnOutlinedIcon from "@mui/icons-material/AssignmentReturnOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import apo from "../Assets/apo.jpeg";
import api from "../api";
import "../Styles/theme.css";
import "../Styles/AboutPage.css";
import usePageTitle from "../utils/usePageTitle";

const shopLink = (category) => `/shop?category=${encodeURIComponent(category)}`;

const About = () => {
  usePageTitle("About us");

  // Real numbers from the shop, so the page never claims something that isn't true
  const [products, setProducts] = useState(null);
  const [stores, setStores] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .get("/products")
      .then((res) => alive && setProducts(Array.isArray(res.data) ? res.data : []))
      .catch(() => alive && setProducts([]));
    api
      .get("/places")
      .then((res) => alive && setStores(Array.isArray(res.data) ? res.data : []))
      .catch(() => alive && setStores([]));
    return () => {
      alive = false;
    };
  }, []);

  const categories = useMemo(() => {
    const map = new Map();
    (products || []).forEach((p) => {
      const name = p.category_name || "Other";
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [products]);

  const brands = useMemo(
    () => [...new Set((products || []).map((p) => String(p.brand || "").trim()).filter(Boolean))].sort(),
    [products]
  );

  const storeCount = stores?.length || 0;

  const stats = [
    { value: stores ? storeCount || "—" : "…", label: storeCount === 1 ? "Store in Lebanon" : "Stores in Lebanon" },
    { value: products ? (products.length ? `${products.length}+` : "—") : "…", label: "Products to choose from" },
    { value: products ? categories.length || "—" : "…", label: "Categories, from GPUs to gear" },
    { value: "7 days", label: "To change your mind" },
  ];

  const reasons = [
    {
      icon: LocalShippingOutlinedIcon,
      title: "Delivery all over Lebanon",
      text: "We deliver to every area, and Beirut orders arrive faster.",
      link: { to: "/shipping", label: "Delivery info" },
    },
    {
      icon: PaymentsOutlinedIcon,
      title: "Pay when it arrives",
      text: "Cash on delivery: you only pay once your order is in your hands.",
    },
    {
      icon: AssignmentReturnOutlinedIcon,
      title: "7-day returns",
      text: "Changed your mind? Bring it back within 7 days in its original condition.",
      link: { to: "/returns", label: "How returns work" },
    },
    {
      icon: StorefrontOutlinedIcon,
      title: "Real stores, real people",
      text:
        storeCount > 1
          ? `See the gear in person at any of our ${storeCount} stores before you buy.`
          : "See the gear in person at our store before you buy.",
      link: { to: "/menu", label: "Find a store" },
    },
    {
      icon: SupportAgentOutlinedIcon,
      title: "Advice before you buy",
      text: "Not sure a part fits your build? Ask us and we'll help you choose.",
      link: { to: "/contact", label: "Ask us" },
    },
    {
      icon: VerifiedOutlinedIcon,
      title: "Brands you know",
      text: brands.length
        ? `${brands.slice(0, 4).join(", ")}${brands.length > 4 ? " and more" : ""}, chosen for performance and value.`
        : "Gear from trusted brands, chosen for performance and value.",
    },
  ];

  return (
    <section className="mt-page">
      <div className="mt-container">
        {/* ===== HERO ===== */}
        <div className="ab-hero">
          <div className="ab-hero__copy">
            <span className="mt-eyebrow">About MegaTech</span>
            <h1 className="mt-title ab-hero__title">PC gear, from people who actually use it</h1>
            <p className="mt-lead">
              MegaTech was founded by Ibrahim Ismail and a partner with one simple idea: getting the
              right PC parts in Lebanon should be easy, fairly priced and backed by people you can
              talk to.
            </p>

            <div className="ab-hero__actions">
              <Link to="/shop" className="mt-btn mt-btn--primary">
                Explore products <ArrowForwardIcon />
              </Link>
              <Link to="/menu" className="mt-btn mt-btn--secondary">
                Visit a store
              </Link>
            </div>
          </div>

          <div className="ab-hero__media">
            <img src={apo} alt="A gaming setup with a monitor, keyboard and headset" />
          </div>
        </div>

        {/* ===== NUMBERS ===== */}
        <div className="ab-stats mt-panel" aria-label="MegaTech in numbers">
          {stats.map((s) => (
            <div className="ab-stat" key={s.label}>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        {/* ===== STORY ===== */}
        <section className="mt-section ab-story">
          <div className="ab-story__text">
            <span className="mt-eyebrow">Our story</span>
            <h2>How MegaTech started</h2>
            <p>
              Building or upgrading a PC shouldn't mean visiting five shops, comparing confusing
              specs and hoping a part fits. That's the problem MegaTech set out to fix.
            </p>
            <p>
              We bring graphics cards, laptops, monitors and gaming gear together in one place, both
              online and in our stores, with clear prices and honest advice. Whether you're
              building your first gaming PC or upgrading a work setup, we help you pick what's
              right for you, not just what's most expensive.
            </p>
            <p>
              Today MegaTech serves customers all over Lebanon, and we're just getting started.
            </p>
          </div>

          <aside className="ab-founders mt-panel" aria-label="Founders">
            <div className="ab-founders__avatars" aria-hidden="true">
              <span>I</span>
              <span>+</span>
            </div>
            <h3>Ibrahim Ismail &amp; partner</h3>
            <p className="ab-founders__role">Co-founders of MegaTech</p>
            <p className="ab-founders__note">
              Every product we sell is one we'd be happy to put in our own setups.
            </p>
            <Link to="/contact" className="mt-link">
              Get in touch <ArrowForwardIcon fontSize="inherit" />
            </Link>
          </aside>
        </section>

        {/* ===== WHY US ===== */}
        <section className="mt-section">
          <div className="mt-section-head">
            <div>
              <h2>Why shop with MegaTech</h2>
              <p>The things our customers count on, every order.</p>
            </div>
          </div>

          <div className="ab-reasons">
            {reasons.map(({ icon: Icon, title, text, link }) => (
              <article className="ab-reason mt-panel" key={title}>
                <span className="ab-icon">
                  <Icon />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  {link && (
                    <Link to={link.to} className="ab-reason__link">
                      {link.label} <ArrowForwardIcon fontSize="inherit" />
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ===== WHAT WE SELL ===== */}
        {categories.length > 0 && (
          <section className="mt-section">
            <div className="mt-section-head">
              <div>
                <h2>What we sell</h2>
                <p>Everything for your setup, in one place.</p>
              </div>
              <Link to="/shop" className="mt-link">
                Shop everything <ArrowForwardIcon fontSize="inherit" />
              </Link>
            </div>

            <div className="ab-cats">
              {categories.map((c) => (
                <Link key={c.name} to={shopLink(c.name)} className="ab-cat">
                  <span>{c.name}</span>
                  <small>
                    {c.count} {c.count === 1 ? "product" : "products"}
                  </small>
                  <ArrowForwardIcon className="ab-cat__arrow" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ===== STORES ===== */}
        {storeCount > 0 && (
          <section className="mt-section">
            <div className="mt-section-head">
              <div>
                <h2>Visit us</h2>
                <p>Come see the gear in person and talk to our team.</p>
              </div>
              <Link to="/menu" className="mt-link">
                Directions &amp; maps <ArrowForwardIcon fontSize="inherit" />
              </Link>
            </div>

            <div className="ab-stores">
              {stores.map((s) => (
                <Link key={s.id} to="/menu" className="ab-store mt-panel">
                  <span className="ab-icon">
                    <PlaceOutlinedIcon />
                  </span>
                  <div>
                    <h3>{s.name}</h3>
                    {s.address && <p>{s.address}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ===== CTA ===== */}
        <section className="mt-cta">
          <div>
            <h2>Ready to upgrade your setup?</h2>
            <p>Browse the full catalog, or visit one of our stores.</p>
          </div>
          <div className="mt-cta__actions">
            <Link to="/shop" className="mt-btn mt-btn--primary">
              Shop now
            </Link>
            <Link to="/menu" className="mt-btn mt-btn--secondary">
              Find a store
            </Link>
          </div>
        </section>
      </div>
    </section>
  );
};

export default About;
