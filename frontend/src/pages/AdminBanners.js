import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import LaptopMacOutlinedIcon from "@mui/icons-material/LaptopMacOutlined";
import PhoneIphoneOutlinedIcon from "@mui/icons-material/PhoneIphoneOutlined";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import ViewCarouselOutlinedIcon from "@mui/icons-material/ViewCarouselOutlined";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import api from "../api";
import { useAdmin } from "../Components/admin/AdminLayout";
import { PageHeader, FilterTabs, apiError } from "../Components/admin/AdminUI";
import BannerSlide, { TOP_BANNER_ASPECT } from "../Components/BannerSlide";
import PromoSections from "../Components/admin/PromoSections";
import { IMAGE_TYPES, ScaledStage, LinkField, DesignFields, formatDay, imageProblem } from "../Components/admin/BannerParts";
import { imageUrl } from "../utils/shop";

const DESIGN = { text_align: "left", text_color: "light", shade: "medium", focus_x: 50, focus_y: 50, img_zoom: 100, img_fill: "dark", starts_on: "", ends_on: "" };
const EMPTY = { eyebrow: "", title: "", subtitle: "", button_text: "Shop now", link: "/shop", active: true, ...DESIGN };

// The real home page banner, drawn at big-screen size and scaled down to fit,
// with look-alike slider arrows so the text sits where it does on the home page
const ComputerPreview = ({ banner, image }) => (
  <ScaledStage>
    <section className="hp-slider">
      <BannerSlide banner={banner} image={image} preview>
        <div className="hp-slider__controls" aria-hidden="true">
          <span className="hp-slider__arrow">
            <ChevronLeftIcon />
          </span>
          <div className="hp-slider__dots">
            <button type="button" tabIndex={-1} className="is-active" />
            <button type="button" tabIndex={-1} />
            <button type="button" tabIndex={-1} />
          </div>
          <span className="hp-slider__arrow">
            <ChevronRightIcon />
          </span>
        </div>
      </BannerSlide>
    </section>
  </ScaledStage>
);

// The phone layout; shows the phone picture when there is one (the preview isn't a real phone
// screen, so it's passed in as the picture itself)
const PhonePreview = ({ banner, image, phoneImage }) => (
  <div className="ad-bprev ad-bprev--phone">
    <div className="ad-bprev__phone mt-scope">
      <section className="hp-slider">
        <BannerSlide banner={phoneImage ? { ...banner, img_zoom: 100, focus_x: 50, focus_y: 50 } : banner} image={phoneImage || image} preview />
      </section>
    </div>
  </div>
);
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
  // optional picture made for phones (shown there instead of a crop of the wide picture)
  const [phoneFile, setPhoneFile] = useState(null);
  const [phonePreview, setPhonePreview] = useState("");
  const [existingPhone, setExistingPhone] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState("computer"); // which preview is shown
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "promos" ? "promos" : "top"; // ?tab=promos opens the promo sections
  const [promoCount, setPromoCount] = useState(null);

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
  useEffect(() => () => phonePreview && URL.revokeObjectURL(phonePreview), [phonePreview]);

  const resetPhone = (existing = "") => {
    setPhoneFile(null);
    setPhonePreview("");
    setExistingPhone(existing);
  };

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
    resetPhone();
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
      img_zoom: b.img_zoom ?? 100,
      img_fill: b.img_fill || "dark",
      starts_on: b.starts_on || "",
      ends_on: b.ends_on || "",
    });
    setFile(null);
    setPreview("");
    setExistingImage(b.image);
    resetPhone(b.image_mobile || "");
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const close = () => setEditing(null);

  const pickFile = (e) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    const problem = imageProblem(picked);
    if (problem) {
      setFormError(problem);
      return;
    }
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
    setFormError("");
  };

  const pickPhoneFile = (e) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    const problem = imageProblem(picked);
    if (problem) return setFormError(problem);
    setPhoneFile(picked);
    setPhonePreview(URL.createObjectURL(picked));
    setDevice("phone");
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
    if (phoneFile) form.append("image_mobile", phoneFile);
    else if (!existingPhone) form.append("remove_image_mobile", "1");

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
  const shownPhone = phonePreview || (existingPhone ? imageUrl(existingPhone) : "");
  const liveCount = banners.filter((b) => b.active).length;

  return (
    <>
      <PageHeader
        title="Banners"
        subtitle={
          tab === "promos"
            ? "Rows of 1 to 3 promo banners between the sections of the home page, like big stores."
            : liveCount
            ? `${liveCount} live in the top slider. Use the arrows to set the order.`
            : "The big banner at the top of the home page. With no banners live, it shows your categories automatically."
        }
        actions={
          tab === "top" &&
          editing === null && (
            <button type="button" className="mt-btn mt-btn--primary" onClick={openNew}>
              <AddIcon /> Add banner
            </button>
          )
        }
      />

      <div className="mt-panel ad-banner-tabs">
        <FilterTabs
          label="Banner type"
          value={tab}
          onChange={(t) => setParams(t === "promos" ? { tab: "promos" } : {}, { replace: true })}
          tabs={[
            { value: "top", label: "Top slider", count: banners.length },
            { value: "promos", label: "Promo sections", count: promoCount ?? "…" },
          ]}
        />
      </div>

      {tab === "promos" ? (
        <PromoSections categories={categories} onCount={setPromoCount} />
      ) : (
        <>
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
                    <PhonePreview banner={values} image={shownImage} phoneImage={shownPhone} />
                  )}
                  <small className="ad-hint">
                    Live preview: the banner has the same shape on every computer, so this is what customers see (bigger or smaller). On phones the text sits under the picture.
                    Best picture size: <strong>2400 × 675 px</strong> (for example a Canva custom size); then nothing is trimmed.
                  </small>

                  {/* optional picture made for phones */}
                  <div className="ad-phone-pic">
                    {shownPhone ? (
                      <img src={shownPhone} alt="" className="ad-phone-pic__thumb" />
                    ) : (
                      <span className="ad-phone-pic__thumb ad-phone-pic__thumb--empty" aria-hidden="true">
                        <PhoneIphoneOutlinedIcon />
                      </span>
                    )}
                    <div className="ad-phone-pic__text">
                      <strong>Phone picture (optional)</strong>
                      <small className="ad-hint">
                        {shownPhone
                          ? "Phones show this picture. Best size 1200 × 600 px."
                          : "A picture made for phones, e.g. in Canva at 1200 × 600 px. Without one, phones show the middle of the main picture."}
                      </small>
                    </div>
                    <div className="ad-phone-pic__actions">
                      <label className="mt-btn mt-btn--secondary mt-btn--sm">
                        <input type="file" accept={IMAGE_TYPES.join(",")} onChange={pickPhoneFile} hidden />
                        <AddPhotoAlternateOutlinedIcon /> {shownPhone ? "Replace" : "Add phone picture"}
                      </label>
                      {shownPhone && (
                        <button type="button" className="mt-btn mt-btn--ghost mt-btn--sm" onClick={() => resetPhone()}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="ad-banner-preview" aria-label="Preview">
                  <label className="ad-banner-preview__empty">
                    <input type="file" accept={IMAGE_TYPES.join(",")} onChange={pickFile} />
                    <AddPhotoAlternateOutlinedIcon />
                    <strong>Click to choose the banner image</strong>
                    <small>Best size: 2400 × 675 px (other sizes are trimmed to fit). You add the text and button here, no need to put them in the picture.</small>
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
                <LinkField value={values.link} onChange={(link) => setValues((v) => ({ ...v, link }))} categories={categories} />
              </div>

              <DesignFields values={values} onChange={(change) => setValues((v) => ({ ...v, ...change }))} image={shownImage} aspect={TOP_BANNER_ASPECT} phoneAspect={shownPhone ? null : 2} />

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
      )}
    </>
  );
}

export default AdminBanners;
