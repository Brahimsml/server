import React from "react";
import { Link } from "react-router-dom";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { imageUrl } from "../utils/shop";

/*
  One home page banner (Admin → Banners): the picture, the fade behind the text and the text.
  Used on the home page and in the admin's live preview, so both always look the same.
  Design settings: text_align (left/center/right), text_color (light/dark),
  shade (none/light/medium/strong), focus_x/focus_y (the spot of the picture that stays visible).
*/
const BannerSlide = ({ banner, image, preview = false, children }) => {
  const align = banner.text_align || "left";
  const color = banner.text_color || "light";
  const shade = banner.shade || "medium";
  const focus = `${banner.focus_x ?? 50}% ${banner.focus_y ?? 50}%`;
  const buttonText = banner.button_text || "Shop now";

  const external = /^https?:/i.test(banner.link || "");

  // The whole banner opens the page (like big stores); the button stays as the clear call to action.
  // Not in the admin preview.
  const hit = preview ? null : external ? (
    <a href={banner.link} className="hp-banner__hit" target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true" />
  ) : (
    <Link to={banner.link} className="hp-banner__hit" tabIndex={-1} aria-hidden="true" />
  );

  // A page on this site, or an outside link in a new tab (just a look-alike in the preview)
  const button = preview ? (
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
    <div className={`hp-slide hp-slide--banner hp-banner--${align} hp-banner--text-${color} hp-banner--shade-${shade} ${hit ? "is-clickable" : ""}`}>
      {(image || banner.image) && (
        <img className="hp-banner__img" src={image || imageUrl(banner.image)} alt="" style={{ objectPosition: focus }} />
      )}
      {hit}
      <div className="hp-slide__copy">
        {banner.eyebrow && <span className="hp-slide__cat">{banner.eyebrow}</span>}
        <h2 className="hp-slide__title">{banner.title || "Your headline"}</h2>
        {banner.subtitle && <p className="hp-slide__desc">{banner.subtitle}</p>}
        <div className="hp-slide__actions">{button}</div>
        {children}
      </div>
    </div>
  );
};

export default BannerSlide;
