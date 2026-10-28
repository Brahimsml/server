import { useEffect, useMemo, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import ViewCarouselOutlinedIcon from "@mui/icons-material/ViewCarouselOutlined";
import SmartphoneOutlinedIcon from "@mui/icons-material/SmartphoneOutlined";
import api from "../api";
import { useAdmin } from "../Components/admin/AdminLayout";
import { PageHeader, apiError } from "../Components/admin/AdminUI";
import { imageUrl } from "../utils/shop";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_MB = 5;
const EMPTY = { eyebrow: "", title: "", subtitle: "", button_text: "Shop now", link: "/shop", active: true };
const CUSTOM = "__custom";

const categoryLink = (name) => `/shop?category=${encodeURIComponent(name)}`;

/*
  Home page banners: a picture (1600 x 600) with a headline and a button.
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
  // optional phone picture (taller, 1200 x 900)
  const [mobileFile, setMobileFile] = useState(null);
  const [mobilePreview, setMobilePreview] = useState("");
  const [existingMobile, setExistingMobile] = useState("");
  const [removeMobile, setRemoveMobile] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

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
  useEffect(() => () => mobilePreview && URL.revokeObjectURL(mobilePreview), [mobilePreview]);

  const resetMobile = (existing = "") => {
    setMobileFile(null);
    setMobilePreview("");
    setExistingMobile(existing);
    setRemoveMobile(false);
  };

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
    resetMobile();
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
    });
    setFile(null);
    setPreview("");
    setExistingImage(b.image);
    resetMobile(b.image_mobile || "");
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

  const pickMobile = (e) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    if (!IMAGE_TYPES.includes(picked.type) || picked.size > MAX_IMAGE_MB * 1024 * 1024) {
      setFormError(`Use a JPG, PNG or WEBP image up to ${MAX_IMAGE_MB} MB.`);
      return;
    }
    setMobileFile(picked);
    setMobilePreview(URL.createObjectURL(picked));
    setRemoveMobile(false);
    setFormError("");
  };

  const save = async (e) => {
    e.preventDefault();
    if (editing === "new" && !file) return setFormError("Choose a banner image (1600 x 600 works best).");
    if (!values.title.trim()) return setFormError("Enter a headline.");
    if (!values.link.trim()) return setFormError("Choose where the button goes.");

    const form = new FormData();
    Object.entries(values).forEach(([k, v]) => form.append(k, k === "active" ? (v ? "1" : "0") : String(v).trim()));
    if (file) form.append("image", file);
    if (mobileFile) form.append("image_mobile", mobileFile);
    else if (removeMobile) form.append("remove_mobile", "1");

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
  const shownMobile = mobilePreview || (existingMobile && !removeMobile ? imageUrl(existingMobile) : "");
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
            {/* Live preview: how it looks on the home page */}
            <div className="ad-banner-preview" aria-label="Preview">
              {shownImage ? (
                <img src={shownImage} alt="" />
              ) : (
                <label className="ad-banner-preview__empty">
                  <input type="file" accept={IMAGE_TYPES.join(",")} onChange={pickFile} />
                  <AddPhotoAlternateOutlinedIcon />
                  <strong>Click to choose the banner image</strong>
                  <small>1600 x 600 px works best · keep the left side dark and empty for the text</small>
                </label>
              )}
              <div className="ad-banner-preview__copy">
                {values.eyebrow && <span className="ad-banner-preview__eyebrow">{values.eyebrow}</span>}
                <strong className="ad-banner-preview__title">{values.title || "Your headline"}</strong>
                {values.subtitle && <span className="ad-banner-preview__sub">{values.subtitle}</span>}
                <span className="ad-banner-preview__btn">
                  {values.button_text || "Shop now"} <ArrowForwardIcon fontSize="inherit" />
                </span>
              </div>
            </div>

            {shownImage && (
              <label className="mt-btn mt-btn--secondary mt-btn--sm ad-banner-replace">
                <input type="file" accept={IMAGE_TYPES.join(",")} onChange={pickFile} hidden />
                <AddPhotoAlternateOutlinedIcon /> Replace image
              </label>
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

            {/* optional phone picture */}
            <div className="ad-banner-phone">
              <div className="ad-banner-phone__preview">
                {shownMobile ? <img src={shownMobile} alt="" /> : <SmartphoneOutlinedIcon />}
              </div>
              <div className="ad-banner-phone__text">
                <strong>Phone picture (optional)</strong>
                <small>
                  A taller version for phones, about 1200 x 900. Put the product big in the middle. Without one, phones show
                  the main picture.
                </small>
                <div className="ad-banner-phone__actions">
                  <label className="mt-btn mt-btn--secondary mt-btn--sm">
                    <input type="file" accept={IMAGE_TYPES.join(",")} onChange={pickMobile} hidden />
                    <AddPhotoAlternateOutlinedIcon /> {shownMobile ? "Replace" : "Add phone picture"}
                  </label>
                  {shownMobile && (
                    <button
                      type="button"
                      className="mt-link"
                      onClick={() => {
                        setMobileFile(null);
                        setMobilePreview("");
                        setRemoveMobile(true);
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
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
                    {b.image_mobile && " · has phone picture"}
                  </small>
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
