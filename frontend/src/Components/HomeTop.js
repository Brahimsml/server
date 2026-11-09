import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import BannerSlide from "./BannerSlide";
import FramedImage from "./FramedImage";
import { imageSrcSet, imageUrl, onImageError } from "../utils/shop";

/*
  The top of the home page: the edge-to-edge banner, and the categories as round photos (home page)
  or photo tiles (modern look preview). Styles: Styles/ModernPreview.css ("Banner on top",
  "Categories as circles" and "Categories right under the banner").
*/
const shopLink = (category) => `/shop?category=${encodeURIComponent(category)}`;

// A section that fades in the first time it scrolls into view (not for people who turned motion off)
export const Reveal = ({ as: Tag = "section", className = "", children, ...rest }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-in");
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("is-in"), io.unobserve(e.target))),
      { rootMargin: "0px 0px 40px 0px" } // starts just before it comes into view, so nothing ever looks empty
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`mh-reveal ${className}`} {...rest}>
      {children}
    </Tag>
  );
};

// Banners from Admin → Banners, edge to edge, small dots to switch
export const EdgeBanner = ({ banners, index, onIndex }) => {
  if (!banners.length) return null;
  const at = index % banners.length;
  const banner = banners[at];
  return (
    <section className="mh-hero" aria-roledescription="carousel" aria-label="Offers">
      <div className="hp-slider mh-hero__frame">
        <BannerSlide key={`banner-${banner.id}`} banner={banner} />
      </div>
      {banners.length > 1 && (
        <div className="mh-dots" role="tablist" aria-label="Banners">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={i === at}
              aria-label={`Show ${b.title || `banner ${i + 1}`}`}
              className={i === at ? "is-active" : ""}
              onClick={() => onIndex(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
};

// Categories as equal photo tiles, all visible at once (5 across, 2 on phones), then "Shop everything"
// as wide as needed so the last row always ends flush
export const CategoryTiles = ({ circles, productCount, categoryCount, className = "" }) => {
  const tiles = circles.slice(0, 14);
  if (!tiles.length) return null;
  return (
    <Reveal className={`mh-cats ${className}`} aria-label="Shop by category">
      <div className="mh-catgrid" style={{ "--all-span": 5 - (tiles.length % 5), "--all-span-phone": tiles.length % 2 ? 1 : 2 }}>
        {tiles.map((cat) => (
          <Link key={cat.name} to={shopLink(cat.name)} className="mh-tile">
            {cat.image && (
              <img src={imageUrl(cat.image)} srcSet={imageSrcSet(cat.image, 600)} sizes="(max-width: 900px) 50vw, 20vw" alt="" loading="lazy" onError={onImageError} />
            )}
            <span className="mh-tile__text">
              <small>{cat.count} products</small>
              <strong>{cat.name}</strong>
            </span>
            <span className="mh-tile__go" aria-hidden="true">
              <ArrowForwardIcon fontSize="inherit" />
            </span>
          </Link>
        ))}
        <Link to="/shop" className="mh-tile mh-tile--all">
          <span className="mh-tile__text">
            <small>
              {productCount} products · {categoryCount} categories
            </small>
            <strong>Shop everything</strong>
          </span>
          <span className="mh-tile__go" aria-hidden="true">
            <ArrowForwardIcon fontSize="inherit" />
          </span>
        </Link>
      </div>
    </Reveal>
  );
};

// Categories as round photos in one row (10 fit on a computer; phones swipe), "All products" at the end
export const CategoryCircles = ({ circles, productCount, className = "" }) => {
  if (!circles.length) return null;
  return (
    <Reveal className={`mh-cats ${className}`} aria-label="Shop by category">
      <div className="mh-circles">
        {circles.map((cat) => (
          <Link key={cat.name} to={shopLink(cat.name)} className="mh-circ">
            <span className="mh-circ__pic">
              {/* framed as set in Admin → Categories (crop tool) */}
              {cat.image && <FramedImage src={imageUrl(cat.image)} srcSet={imageSrcSet(cat.image, 320)} sizes="130px" aspect={1} {...cat.frame} onError={onImageError} />}
            </span>
            <span className="mh-circ__name">{cat.name}</span>
            <small>{cat.count} products</small>
          </Link>
        ))}
        <Link to="/shop" className="mh-circ mh-circ--all">
          <span className="mh-circ__pic">
            <GridViewOutlinedIcon />
          </span>
          <span className="mh-circ__name">All products</span>
          <small>{productCount} products</small>
        </Link>
      </div>
    </Reveal>
  );
};
