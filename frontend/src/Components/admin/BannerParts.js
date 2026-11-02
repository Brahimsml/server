import { useLayoutEffect, useRef, useState } from "react";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import CenterFocusStrongOutlinedIcon from "@mui/icons-material/CenterFocusStrongOutlined";

/*
  Pieces shared by the two banner editors in Admin → Banners:
  the top slider (pages/AdminBanners.js) and the promo sections (PromoSections.js).
*/
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_MB = 5;

// Width the computer previews are drawn at (a big screen), then shrunk to fit the panel.
// Banners have one shape on every computer, so this matches all of them.
export const PREVIEW_WIDTH = 1600;

export const ALIGN_OPTIONS = [
  { value: "left", label: "Left", icon: FormatAlignLeftIcon },
  { value: "center", label: "Centre", icon: FormatAlignCenterIcon },
  { value: "right", label: "Right", icon: FormatAlignRightIcon },
];
export const COLOR_OPTIONS = [
  { value: "light", label: "White text" },
  { value: "dark", label: "Black text" },
];
export const SHADE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "strong", label: "Strong" },
];

export const CUSTOM = "__custom";
export const categoryLink = (name) => `/shop?category=${encodeURIComponent(name)}`;

export const formatDay = (day) =>
  day ? new Date(`${day}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";

// A picture the admin picked: JPG, PNG or WEBP up to 5 MB (returns an error message, or "")
export const imageProblem = (file) =>
  !IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_MB * 1024 * 1024 ? `Use a JPG, PNG or WEBP image up to ${MAX_IMAGE_MB} MB.` : "";

// Buttons in a row where one is chosen (text position, text color, fade)
export const Segmented = ({ label, options, value, onChange }) => (
  <div className="ad-seg-field">
    <span className="ad-seg-field__label">{label}</span>
    <div className="ad-seg" role="radiogroup" aria-label={label}>
      {options.map(({ value: v, label: l, icon: Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          className={value === v ? "is-active" : ""}
          onClick={() => onChange(v)}
        >
          {Icon && <Icon fontSize="small" />} {l}
        </button>
      ))}
    </div>
  </div>
);

// Draws the home page at big-screen width and shrinks it to fit the panel
export const ScaledStage = ({ children, interactive = false }) => {
  const outer = useRef(null);
  const inner = useRef(null);
  const [scale, setScale] = useState(0.5);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const measure = () => {
      if (!outer.current || !inner.current) return;
      const s = outer.current.clientWidth / PREVIEW_WIDTH;
      setScale(s);
      setHeight(inner.current.offsetHeight * s);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer.current);
    ro.observe(inner.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="ad-bprev ad-bprev--computer" ref={outer} style={{ height }}>
      <div
        className={`mt-scope hp-home ad-bprev__stage ${interactive ? "is-interactive" : ""}`}
        ref={inner}
        style={{ width: PREVIEW_WIDTH, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
};

// "Button goes to": the shop, a category, or another page/link typed in
export const LinkField = ({ label = "Button goes to", value, onChange, categories }) => {
  const options = [{ value: "/shop", label: "Shop: all products" }, ...categories.map((c) => ({ value: categoryLink(c.name), label: `Category: ${c.name}` }))];
  const choice = options.some((o) => o.value === value) ? value : CUSTOM;
  return (
    <>
      <label className="mt-field">
        <span>{label}</span>
        <select value={choice} onChange={(e) => onChange(e.target.value === CUSTOM ? "" : e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          <option value={CUSTOM}>Another page or link…</option>
        </select>
      </label>
      {choice === CUSTOM && (
        <label className="mt-field ad-field-wide">
          <span>Link</span>
          <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={255} placeholder="/product/12-nvidia-rtx-4090  or  https://..." />
          <small className="ad-hint">Tip: open the product on your site and copy the part after the domain, e.g. /product/12-nvidia-rtx-4090.</small>
        </label>
      )}
    </>
  );
};

// Text position, text color, fade and focus point of one banner
export const DesignFields = ({ values, onChange, image }) => (
  <div className="ad-banner-design">
    <h3 className="ad-banner-design__title">Design</h3>
    <Segmented label="Text position" options={ALIGN_OPTIONS} value={values.text_align} onChange={(v) => onChange({ text_align: v })} />
    <Segmented label="Text color" options={COLOR_OPTIONS} value={values.text_color} onChange={(v) => onChange({ text_color: v })} />
    <Segmented label="Fade behind the text" options={SHADE_OPTIONS} value={values.shade} onChange={(v) => onChange({ shade: v })} />
    <small className="ad-hint">Black text is for bright pictures. Use a stronger fade if the text is hard to read.</small>

    {image && (
      <div className="ad-focus">
        <span className="ad-seg-field__label">
          <CenterFocusStrongOutlinedIcon fontSize="small" /> Focus point
        </span>
        <button
          type="button"
          className="ad-focus__pick"
          aria-label="Click the most important part of the picture"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            onChange({
              focus_x: Math.round(((e.clientX - r.left) / r.width) * 100),
              focus_y: Math.round(((e.clientY - r.top) / r.height) * 100),
            });
          }}
        >
          <img src={image} alt="" />
          <span className="ad-focus__dot" style={{ left: `${values.focus_x}%`, top: `${values.focus_y}%` }} />
        </button>
        <small className="ad-hint">
          Click the most important part (e.g. the product). Every screen trims the picture around it.{" "}
          {(values.focus_x !== 50 || values.focus_y !== 50) && (
            <button type="button" className="ad-linkbtn" onClick={() => onChange({ focus_x: 50, focus_y: 50 })}>
              Reset to the middle
            </button>
          )}
        </small>
      </div>
    )}
  </div>
);
