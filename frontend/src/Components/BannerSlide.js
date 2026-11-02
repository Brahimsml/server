import React from "react";
import { Link } from "react-router-dom";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { imageUrl } from "../utils/shop";

/*
  One home page banner (Admin → Banners): the picture, the fade behind the text and the text.
  Used on the home page and in the admin's live preview, so both always look the same.
  Design settings: text_align (left/center/right), text_color (light/dark),
  shade (none/light/medium/strong), focus_x/focus_y (the spot of the picture that stays visible).
  Top banners always have a headline and a button ("Your headline" / "Shop now" while being made);
  promo banners (placeholder=false) may have neither, then the picture alone is the link.
*/
const BannerSlide = ({ banner, image, preview = false, placeholder = true, children }) => {
  const align = banner.text_align || "left";
  const color = banner.text_color || "light";
  const shade = banner.shade || "medium";
  const focus = `${banner.focus_x ?? 50}% ${banner.focus_y ?? 50}%`;
  const buttonText = banner.button_text || (placeholder ? "Shop now" : "");
  const title = banner.title || (placeholder ? "Your headline" : "");
  const hasText = Boolean(banner.eyebrow || title || banner.subtitle || buttonText || children);

  const external = /^https?:/i.test(banner.link || "");

  // The whole banner opens the page (like big stores); the button stays as the clear call to action.
  // Not in the admin preview.
  // With no button (a picture-only promo) this area is the link itself, so keyboards and screen readers get it.
  const hitProps = buttonText
    ? { tabIndex: -1, "aria-hidden": "true" }
    : { "aria-label": banner.title || banner.eyebrow || "See the offer" };
  const hit = preview ? null : external ? (
    // empty on purpose: an invisible click area (the button, or the label above, is the real link)
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    <a href={banner.link} className="hp-banner__hit" target="_blank" rel="noopener noreferrer" {...hitProps} />
  ) : (
    <Link to={banner.link} className="hp-banner__hit" {...hitProps} />
  );

  // A page on this site, or an outside link in a new tab (just a look-alike in the preview)
  const button = !buttonText ? null : preview ? (
    <span className="mt-btn mt-btn--primary">
      {buttonText} <ArrowForwardIcon />
    </span>
  ) : external ? (
    <a href={banner.link} className="mt-btn mt-btn--primary" target="_blank" rel="noopener noreferrer">
      {buttonText} <ArrowForwardIcon />
    </a>
  ) : (
    <Link to={banner.link} className="mt-btn mt-btn--primary">
      {buttonText} <ArrowForwardIcon />
    </Link>
  );

  return (
    <div
      className={`hp-slide hp-slide--banner hp-banner--${align} hp-banner--text-${color} hp-banner--shade-${shade} ${hit ? "is-clickable" : ""} ${
        hasText ? "" : "hp-banner--no-text"
      }`}
    >
      {(image || banner.image) && (
        <img className="hp-banner__img" src={image || imageUrl(banner.image)} alt="" style={{ objectPosition: focus }} />
      )}
      {hit}
      {hasText && (
        <div className="hp-slide__copy">
          {banner.eyebrow && <span className="hp-slide__cat">{banner.eyebrow}</span>}
          {title && <h2 className="hp-slide__title">{title}</h2>}
          {banner.subtitle && <p className="hp-slide__desc">{banner.subtitle}</p>}
          {button && <div className="hp-slide__actions">{button}</div>}
          {children}
        </div>
      )}
    </div>
  );
};

export default BannerSlide;
