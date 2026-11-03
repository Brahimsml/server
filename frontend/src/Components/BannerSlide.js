import React from "react";
import { Link } from "react-router-dom";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { imageUrl } from "../utils/shop";
import FramedImage from "./FramedImage";

// The shape (width / height) of each banner box: the top slider, and promo banners by layout
export const TOP_BANNER_ASPECT = 32 / 9;
export const PROMO_ASPECT = { wide: 4, halves: 2, thirds: 4 / 3 };

/*
  One home page banner (Admin → Banners): the picture, the fade behind the text and the text.
  Used on the home page and in the admin's live preview, so both always look the same.
  Design settings: text_align (left/center/right), text_color (light/dark),
  shade (none/light/medium/strong), and how the picture sits in its box (crop tool):
  img_zoom, focus_x/focus_y (left/right, up/down), img_fill (dark or blurred around it).
  Top banners can have a picture made for phones (image_mobile), shown there instead of a crop.
  Top banners always have a headline and a button ("Your headline" / "Shop now" while being made);
  promo banners (placeholder=false) may have neither, then the picture alone is the link.
*/
const BannerSlide = ({ banner, image, phoneImage, preview = false, placeholder = true, aspect = TOP_BANNER_ASPECT, children }) => {
  const align = banner.text_align || "left";
  const color = banner.text_color || "light";
  const shade = banner.shade || "medium";
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

  // A page on this site, or an outside link in a new tab (just a look-alike in the preview).
  // The top banner has a big gold button; promo banners a small gold text link, like Apple or Samsung.
  const buttonClass = placeholder ? "mt-btn mt-btn--primary" : "hp-promo-link";
  const button = !buttonText ? null : preview ? (
    <span className={buttonClass}>
      {buttonText} <ArrowForwardIcon />
    </span>
  ) : external ? (
    <a href={banner.link} className={buttonClass} target="_blank" rel="noopener noreferrer">
      {buttonText} <ArrowForwardIcon />
    </a>
  ) : (
    <Link to={banner.link} className={buttonClass}>
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
        <FramedImage
          className="hp-banner__img"
          src={image || imageUrl(banner.image)}
          phoneSrc={phoneImage || (banner.image_mobile ? imageUrl(banner.image_mobile) : undefined)}
          aspect={aspect}
          zoom={banner.img_zoom ?? 100}
          x={banner.focus_x ?? 50}
          y={banner.focus_y ?? 50}
          fill={banner.img_fill || "dark"}
          loading={placeholder ? "eager" : "lazy"}
        />
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
