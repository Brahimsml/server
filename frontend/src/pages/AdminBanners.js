import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import LaptopMacOutlinedIcon from "@mui/icons-material/LaptopMacOutlined";
import PhoneIphoneOutlinedIcon from "@mui/icons-material/PhoneIphoneOutlined";
import CenterFocusStrongOutlinedIcon from "@mui/icons-material/CenterFocusStrongOutlined";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import ViewCarouselOutlinedIcon from "@mui/icons-material/ViewCarouselOutlined";
import api from "../api";
import { useAdmin } from "../Components/admin/AdminLayout";
import { PageHeader, apiError } from "../Components/admin/AdminUI";
import BannerSlide from "../Components/BannerSlide";
import { imageUrl } from "../utils/shop";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_MB = 5;
const DESIGN = { text_align: "left", text_color: "light", shade: "medium", focus_x: 50, focus_y: 50, starts_on: "", ends_on: "" };
const EMPTY = { eyebrow: "", title: "", subtitle: "", button_text: "Shop now", link: "/shop", active: true, ...DESIGN };

const ALIGN_OPTIONS = [
  { value: "left", label: "Left", icon: FormatAlignLeftIcon },
  { value: "center", label: "Centre", icon: FormatAlignCenterIcon },
  { value: "right", label: "Right", icon: FormatAlignRightIcon },
];
const COLOR_OPTIONS = [
  { value: "light", label: "White text" },
  { value: "dark", label: "Black text" },
];
const SHADE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "strong", label: "Strong" },
];

// Width the computer preview is drawn at (a 1440px laptop), then shrunk to fit the panel
const PREVIEW_WIDTH = 1360;

const formatDay = (day) =>
  day ? new Date(`${day}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";

// Buttons in a row where one is chosen (text position, text color, fade)
const Segmented = ({ label, options, value, onChange }) => (
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

// The real home page banner, drawn at laptop size and scaled down to fit
const ComputerPreview = ({ banner, image }) => {
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
      <div className="mt-scope hp-home ad-bprev__stage" ref={inner} style={{ width: PREVIEW_WIDTH, transform: `scale(${scale})` }}>
        <section className="hp-slider">
          <BannerSlide banner={banner} image={image} preview />
        </section>
      </div>
    </div>
  );
};

const PhonePreview = ({ banner, image }) => (
  <div className="ad-bprev ad-bprev--phone">
    <div className="ad-bprev__phone mt-scope">
      <section className="hp-slider">
        <BannerSlide banner={banner} image={image} preview />
      </section>
    </div>
  </div>
);
const CUSTOM = "__custom";

const categoryLink = (name) => `/shop?category=${encodeURIComponent(name)}`;

/*
  Home page banners: a picture with a headline and a button. The picture is kept whole;
  the focus point decides which part stays visible on each screen.
  While at least one banner is live, the home page shows them instead of the
  automatic category slides.
*/
function AdminBanners() {
  const { notify, confirm } = useAdmin();
  const [banners, setBanners] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(null); // null = closed, "new", or a banner id
  const [values, setValues] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [existingImage, setExistingImage] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState("computer"); // which preview is shown

  const load = () =>
    api
      .get("/admin/banners")
      .then((res) => setBanners(Array.isArray(res.data) ? res.data : []))
      .catch(() => setError("We couldn't load the banners. Please refresh the page."));

  useEffect(() => {
    Promise.all([load(), api.get("/categories").then((res) => setCategories(Array.isArray(res.data) ? res.data : []))])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  // The link picker: shop, a category, or a custom address
  const linkOptions = useMemo(
    () => [{ value: "/shop", label: "Shop: all products" }, ...categories.map((c) => ({ value: categoryLink(c.name), label: `Category: ${c.name}` }))],
    [categories]
  );
  const linkChoice = linkOptions.some((o) => o.value === values.link) ? values.link : CUSTOM;

  const set = (name) => (e) => {
    setValues((v) => ({ ...v, [name]: e.target.value }));
    setFormError("");
  };

  const openNew = () => {
    setEditing("new");
    setValues(EMPTY);
    setFile(null);
    setPreview("");
    setExistingImage("");
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openEdit = (b) => {
    setEditing(b.id);
    setValues({
      eyebrow: b.eyebrow || "",
      title: b.title || "",
      subtitle: b.subtitle || "",
      button_text: b.button_text || "Shop now",
      link: b.link || "/shop",
      active: !!b.active,
      text_align: b.text_align || DESIGN.text_align,
      text_color: b.text_color || DESIGN.text_color,
      shade: b.shade || DESIGN.shade,
      focus_x: b.focus_x ?? 50,
      focus_y: b.focus_y ?? 50,
      starts_on: b.starts_on || "",
      ends_on: b.ends_on || "",
    });
    setFile(null);
    setPreview("");
    setExistingImage(b.image);
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const close = () => setEditing(null);

  const pickFile = (e) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    if (!IMAGE_TYPES.includes(picked.type) || picked.size > MAX_IMAGE_MB * 1024 * 1024) {
      setFormError(`Use a JPG, PNG or WEBP image up to ${MAX_IMAGE_MB} MB.`);
      return;
    }
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
    setFormError("");
  };

  const save = async (e) => {
    e.preventDefault();
    if (editing === "new" && !file) return setFormError("Choose a banner image.");
    if (!values.title.trim()) return setFormError("Enter a headline.");
    if (!values.link.trim()) return setFormError("Choose where the button goes.");
    if (values.starts_on && values.ends_on && values.ends_on < values.starts_on)
      return setFormError("The end date is before the start date.");

    const form = new FormData();
    Object.entries(values).forEach(([k, v]) => form.append(k, k === "active" ? (v ? "1" : "0") : String(v).trim()));
    if (file) form.append("image", file);

    try {
      setSaving(true);
      if (editing === "new") await api.post("/banners", form);
      else await api.put(`/banners/${editing}`, form);
      await load();
      notify(editing === "new" ? "Banner added" : "Banner updated");
      setEditing(null);
    } catch (err) {
      setFormError(apiError(err, "We couldn't save this banner."));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (b) => {
    try {
      await api.put(`/banners/${b.id}/active`, { active: !b.active });
      setBanners((list) => list.map((x) => (x.id === b.id ? { ...x, active: b.active ? 0 : 1 } : x)));
      notify(b.active ? `"${b.title}" is hidden` : `"${b.title}" is live on the home page`);
    } catch (err) {
      notify(apiError(err, "We couldn't change this banner."), "error");
    }
  };

  const move = async (index, dir) => {
    const to = index + dir;
    if (to < 0 || to >= banners.length || busy) return;
    const before = banners;
    const next = [...banners];
    [next[index], next[to]] = [next[to], next[index]];
    setBanners(next);
    setBusy(true);
    try {
      await api.put("/banners/order", { ids: next.map((b) => b.id) });
    } catch (err) {
      setBanners(before);
      notify(apiError(err, "We couldn't save the new order."), "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (b) => {
    const ok = await confirm({
      title: "Delete banner?",
      message: `"${b.title}" and its picture will be removed. To keep it for later, hide it instead.`,
      confirmLabel: "Delete banner",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/banners/${b.id}`);
      setBanners((list) => list.filter((x) => x.id !== b.id));
      if (editing === b.id) setEditing(null);
      notify("Banner deleted");
    } catch (err) {
      notify(apiError(err, "We couldn't delete this banner."), "error");
    }
  };

  const shownImage = preview || (existingImage ? imageUrl(existingImage) : "");
  const liveCount = banners.filter((b) => b.active).length;

  return (
    <>
      <PageHeader
        title="Banners"
        subtitle={
          liveCount
            ? `${liveCount} live on the home page. Use the arrows to set the order.`
            : "The big banner at the top of the home page. With no banners live, it shows your categories automatically."
        }
        actions={
          editing === null && (
            <button type="button" className="mt-btn mt-btn--primary" onClick={openNew}>
              <AddIcon /> Add banner
            </button>
          )
        }
      />

      {error && <div className="mt-alert mt-alert--error">{error}</div>}

      {/* ===== Add / edit ===== */}
      {editing !== null && (
        <form className="mt-panel ad-banner-form" onSubmit={save} noValidate>
          <div className="ad-panel-head">
            <h2>{editing === "new" ? "New banner" : "Edit banner"}</h2>
          </div>

          <div className="ad-panel-body">
            {/* Live preview: exactly what the home page will show */}
            {shownImage ? (
              <div className="ad-bprev-wrap">
                <div className="ad-bprev-bar">
                  <div className="ad-seg" role="tablist" aria-label="Preview on">
                    <button type="button" role="tab" aria-selected={device === "computer"} className={device === "computer" ? "is-active" : ""} onClick={() => setDevice("computer")}>
                      <LaptopMacOutlinedIcon fontSize="small" /> Computer
                    </button>
                    <button type="button" role="tab" aria-selected={device === "phone"} className={device === "phone" ? "is-active" : ""} onClick={() => setDevice("phone")}>
                      <PhoneIphoneOutlinedIcon fontSize="small" /> Phone
                    </button>
                  </div>
                  <label className="mt-btn mt-btn--secondary mt-btn--sm ad-banner-replace">
                    <input type="file" accept={IMAGE_TYPES.join(",")} onChange={pickFile} hidden />
                    <AddPhotoAlternateOutlinedIcon /> Replace image
                  </label>
                </div>
                {device === "computer" ? (
                  <ComputerPreview banner={values} image={shownImage} />
                ) : (
                  <PhonePreview banner={values} image={shownImage} />
                )}
                <small className="ad-hint">Live preview: exactly what customers see, before and after saving. On phones the text sits under the picture.</small>
              </div>
            ) : (
              <div className="ad-banner-preview" aria-label="Preview">
                <label className="ad-banner-preview__empty">
                  <input type="file" accept={IMAGE_TYPES.join(",")} onChange={pickFile} />
                  <AddPhotoAlternateOutlinedIcon />
                  <strong>Click to choose the banner image</strong>
                  <small>Any photo works; wide ones need the least trimming. You add the text and button here, no need to design it.</small>
                </label>
              </div>
            )}

            <div className="ad-form-row">
              <label className="mt-field">
                <span>Headline</span>
                <input value={values.title} onChange={set("title")} maxLength={120} placeholder="e.g. Next-gen graphics power" />
              </label>
              <label className="mt-field">
                <span>Small line above (optional)</span>
                <input value={values.eyebrow} onChange={set("eyebrow")} maxLength={60} placeholder="e.g. Graphics cards" />
              </label>
            </div>

            <label className="mt-field">
              <span>Short text under the headline (optional)</span>
              <input
                value={values.subtitle}
                onChange={set("subtitle")}
                maxLength={220}
                placeholder="e.g. The latest GPUs for smooth 4K gaming."
              />
            </label>

            <div className="ad-form-row">
              <label className="mt-field">
                <span>Button text</span>
                <input value={values.button_text} onChange={set("button_text")} maxLength={40} placeholder="Shop now" />
              </label>
              <label className="mt-field">
                <span>Button goes to</span>
                <select
                  value={linkChoice}
                  onChange={(e) => setValues((v) => ({ ...v, link: e.target.value === CUSTOM ? "" : e.target.value }))}
                >
                  {linkOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                  <option value={CUSTOM}>Another page or link…</option>
                </select>
              </label>
            </div>

            {linkChoice === CUSTOM && (
              <label className="mt-field">
                <span>Link</span>
                <input
                  value={values.link}
                  onChange={set("link")}
                  maxLength={255}
                  placeholder="/product/12-nvidia-rtx-4090  or  https://..."
                />
                <small className="ad-hint">Tip: open the product on your site and copy the part after the domain, e.g. /product/12-nvidia-rtx-4090.</small>
              </label>
            )}

            <div className="ad-banner-design">
              <h3 className="ad-banner-design__title">Design</h3>
              <Segmented label="Text position" options={ALIGN_OPTIONS} value={values.text_align} onChange={(v) => setValues((x) => ({ ...x, text_align: v }))} />
              <Segmented label="Text color" options={COLOR_OPTIONS} value={values.text_color} onChange={(v) => setValues((x) => ({ ...x, text_color: v }))} />
              <Segmented label="Fade behind the text" options={SHADE_OPTIONS} value={values.shade} onChange={(v) => setValues((x) => ({ ...x, shade: v }))} />
              <small className="ad-hint">Black text is for bright pictures. Use a stronger fade if the text is hard to read.</small>

              {shownImage && (
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
                      setValues((x) => ({
                        ...x,
                        focus_x: Math.round(((e.clientX - r.left) / r.width) * 100),
                        focus_y: Math.round(((e.clientY - r.top) / r.height) * 100),
                      }));
                    }}
                  >
                    <img src={shownImage} alt="" />
                    <span className="ad-focus__dot" style={{ left: `${values.focus_x}%`, top: `${values.focus_y}%` }} />
                  </button>
                  <small className="ad-hint">
                    Click the most important part (e.g. the product). Every screen trims the picture around it.{" "}
                    {(values.focus_x !== 50 || values.focus_y !== 50) && (
                      <button type="button" className="ad-linkbtn" onClick={() => setValues((x) => ({ ...x, focus_x: 50, focus_y: 50 }))}>
                        Reset to the middle
                      </button>
                    )}
                  </small>
                </div>
              )}
            </div>

            <div className="ad-banner-design">
              <h3 className="ad-banner-design__title">Schedule (optional)</h3>
              <div className="ad-form-row">
                <label className="mt-field">
                  <span>Show from</span>
                  <input type="date" value={values.starts_on} onChange={set("starts_on")} />
                </label>
                <label className="mt-field">
                  <span>Show until</span>
                  <input type="date" value={values.ends_on} min={values.starts_on || undefined} onChange={set("ends_on")} />
                </label>
              </div>
              <small className="ad-hint">For a sale or a launch: the banner turns on and off by itself. Leave empty to show it all the time.</small>
            </div>

            <label className="ad-switch">
              <input type="checkbox" checked={values.active} onChange={(e) => setValues((v) => ({ ...v, active: e.target.checked }))} />
              <span>Show on the home page</span>
            </label>

            {formError && (
              <div className="mt-alert mt-alert--error" role="alert">
                {formError}
              </div>
            )}
          </div>

          <div className="ad-banner-form__actions">
            <button type="button" className="mt-btn mt-btn--secondary" onClick={close} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="mt-btn mt-btn--primary" disabled={saving}>
              {saving ? "Saving…" : editing === "new" ? "Add banner" : "Save changes"}
            </button>
          </div>
        </form>
      )}

      {/* ===== List ===== */}
      <section className="mt-panel">
        {loading ? (
          <div className="ad-panel-body" style={{ display: "grid", gap: 10 }}>
            {[0, 1].map((i) => (
              <div key={i} className="mt-skeleton" style={{ height: 90, borderRadius: 12 }} />
            ))}
          </div>
        ) : banners.length === 0 ? (
          <div className="mt-empty">
            <div className="mt-empty__icon">
              <ViewCarouselOutlinedIcon fontSize="inherit" />
            </div>
            <h3>No banners yet</h3>
            <p>The home page shows your categories automatically. Add a banner to promote something.</p>
            {editing === null && (
              <button type="button" className="mt-btn mt-btn--primary" onClick={openNew}>
                <AddIcon /> Add banner
              </button>
            )}
          </div>
        ) : (
          <ul className="ad-banners">
            {banners.map((b, i) => (
              <li key={b.id} className={`ad-banner-row ${b.active ? "" : "is-hidden"}`}>
                <div className="ad-row-actions ad-order">
                  <span className="ad-order__pos">{i + 1}</span>
                  <button type="button" className="ad-icon-btn" onClick={() => move(i, -1)} disabled={i === 0 || busy} aria-label={`Move ${b.title} up`} title="Move up">
                    <ArrowUpwardIcon />
                  </button>
                  <button
                    type="button"
                    className="ad-icon-btn"
                    onClick={() => move(i, 1)}
                    disabled={i === banners.length - 1 || busy}
                    aria-label={`Move ${b.title} down`}
                    title="Move down"
                  >
                    <ArrowDownwardIcon />
                  </button>
                </div>
                <img className="ad-banner-row__img" src={imageUrl(b.image)} alt="" />
                <div className="ad-banner-row__text">
                  <strong>{b.title}</strong>
                  <small>
                    {b.button_text} → {b.link}
                  </small>
                  {(b.starts_on || b.ends_on) && (
                    <small className={`ad-banner-row__when ${b.has_ended ? "is-ended" : b.not_started ? "is-later" : ""}`}>
                      {b.has_ended
                        ? `Ended ${formatDay(b.ends_on)}`
                        : b.not_started
                        ? `Starts ${formatDay(b.starts_on)}${b.ends_on ? ` · until ${formatDay(b.ends_on)}` : ""}`
                        : b.ends_on
                        ? `Showing until ${formatDay(b.ends_on)}`
                        : `Showing since ${formatDay(b.starts_on)}`}
                    </small>
                  )}
                </div>
                <label className="ad-switch ad-banner-row__switch" title={b.active ? "Live on the home page" : "Hidden"}>
                  <input type="checkbox" checked={!!b.active} onChange={() => toggleActive(b)} aria-label={`Show ${b.title} on the home page`} />
                  <span>{b.active ? "Live" : "Hidden"}</span>
                </label>
                <div className="ad-row-actions">
                  <button type="button" className="ad-icon-btn" onClick={() => openEdit(b)} aria-label={`Edit ${b.title}`} title="Edit">
                    <EditOutlinedIcon />
                  </button>
                  <button type="button" className="ad-icon-btn ad-icon-btn--danger" onClick={() => remove(b)} aria-label={`Delete ${b.title}`} title="Delete">
                    <DeleteOutlineIcon />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default AdminBanners;
