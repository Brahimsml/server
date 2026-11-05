import { useEffect, useRef, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import LaptopMacOutlinedIcon from "@mui/icons-material/LaptopMacOutlined";
import PhoneIphoneOutlinedIcon from "@mui/icons-material/PhoneIphoneOutlined";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import DashboardCustomizeOutlinedIcon from "@mui/icons-material/DashboardCustomizeOutlined";
import api from "../../api";
import { useAdmin } from "./AdminLayout";
import { apiError } from "./AdminUI";
import BannerSlide, { PROMO_ASPECT } from "../BannerSlide";
import { imageUrl } from "../../utils/shop";
import { IMAGE_TYPES, ScaledStage, LinkField, DesignFields, formatDay, imageProblem } from "./BannerParts";

/*
  Admin → Banners → Promo sections: rows of 1-3 promo banners between the sections of the
  home page, set up like big store builders (Shopify, Amazon stores): pick a layout, fill
  each slot (picture, optional text and button, where it goes), choose where on the page
  the row shows, and schedule or hide the whole row at once.
*/
const LAYOUTS = [
  { value: "wide", label: "1 wide banner", count: 1, size: "2400 × 600" },
  { value: "halves", label: "2 side by side", count: 2, size: "1200 × 600" },
  { value: "thirds", label: "3 tiles", count: 3, size: "800 × 600" },
];
const layoutOf = (value) => LAYOUTS.find((l) => l.value === value) || LAYOUTS[1];

// Where on the home page (top to bottom); category rows are added from the shop's categories
const SPOTS = [
  { value: "after_trust", label: "Under the top banner" },
  { value: "after_categories", label: "After Shop by category" },
  { value: "after_best", label: "After Best sellers" },
  { value: "after_new", label: "After New arrivals" },
];
const spotLabel = (position) =>
  position.startsWith("cat:")
    ? `After the ${position.slice(4)} row`
    : position === "bottom"
    ? "At the bottom of the page"
    : SPOTS.find((s) => s.value === position)?.label || position;

const EMPTY_SLOT = {
  eyebrow: "",
  title: "",
  subtitle: "",
  button_text: "", // promos look cleanest without one: the whole picture is the link
  link: "/shop",
  text_align: "left",
  text_color: "light",
  shade: "medium",
  focus_x: 50,
  focus_y: 50,
  img_zoom: 100,
  img_fill: "dark",
};
const EMPTY = { layout: "halves", position: "after_new", active: true, starts_on: "", ends_on: "" };
const three = (value) => [0, 1, 2].map(() => value);

function PromoSections({ categories, onCount }) {
  const { notify, confirm } = useAdmin();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(null); // null = closed, "new", or a section id
  const [values, setValues] = useState(EMPTY);
  const [slots, setSlots] = useState(three(EMPTY_SLOT)); // always 3, so switching layout keeps the work
  const [files, setFiles] = useState(three(null));
  const [previews, setPreviews] = useState(three(""));
  const [existing, setExisting] = useState(three(""));
  const [current, setCurrent] = useState(0); // the slot being edited
  const [device, setDevice] = useState("computer");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null);

  const layout = layoutOf(values.layout);
  const count = layout.count;
  const image = (i) => previews[i] || (existing[i] ? imageUrl(existing[i]) : "");

  const load = () =>
    api
      .get("/admin/promos")
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setSections(list);
        onCount?.(list.length);
      })
      .catch(() => setError("We couldn't load the promo sections. Please refresh the page."));

  useEffect(() => {
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearPreviews = () => previews.forEach((url) => url && URL.revokeObjectURL(url));

  const openForm = (next, nextSlots, nextExisting, id) => {
    clearPreviews();
    setEditing(id);
    setValues(next);
    setSlots(nextSlots);
    setFiles(three(null));
    setPreviews(three(""));
    setExisting(nextExisting);
    setCurrent(0);
    setFormError("");
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const openNew = () => openForm(EMPTY, three(EMPTY_SLOT), three(""), "new");

  const openEdit = (sec) => {
    const bySlot = (i) => sec.slots.find((b) => Number(b.slot) === i);
    openForm(
      {
        layout: sec.layout,
        position: sec.position,
        active: !!sec.active,
        starts_on: sec.starts_on || "",
        ends_on: sec.ends_on || "",
      },
      [0, 1, 2].map((i) => {
        const b = bySlot(i);
        return b
          ? {
              eyebrow: b.eyebrow || "",
              title: b.title || "",
              subtitle: b.subtitle || "",
              button_text: b.button_text || "",
              link: b.link || "/shop",
              text_align: b.text_align || "left",
              text_color: b.text_color || "light",
              shade: b.shade || "medium",
              focus_x: b.focus_x ?? 50,
              focus_y: b.focus_y ?? 50,
              img_zoom: b.img_zoom ?? 100,
              img_fill: b.img_fill || "dark",
            }
          : EMPTY_SLOT;
      }),
      [0, 1, 2].map((i) => bySlot(i)?.image || ""),
      sec.id
    );
  };

  const close = () => {
    clearPreviews();
    setEditing(null);
  };

  const setSection = (change) => {
    setValues((v) => ({ ...v, ...change }));
    setFormError("");
  };

  const setSlot = (i, change) => {
    setSlots((list) => list.map((s, j) => (j === i ? { ...s, ...change } : s)));
    setFormError("");
  };

  const pickFile = (i) => (e) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    const problem = imageProblem(picked);
    if (problem) return setFormError(problem);
    if (previews[i]) URL.revokeObjectURL(previews[i]);
    setFiles((list) => list.map((f, j) => (j === i ? picked : f)));
    setPreviews((list) => list.map((u, j) => (j === i ? URL.createObjectURL(picked) : u)));
    setCurrent(i);
    setFormError("");
  };

  const chooseLayout = (value) => {
    setSection({ layout: value });
    setCurrent((c) => Math.min(c, layoutOf(value).count - 1));
  };

  const save = async (e) => {
    e.preventDefault();
    for (let i = 0; i < count; i += 1) {
      if (!image(i)) {
        setCurrent(i);
        return setFormError(`Add a picture to banner ${i + 1}.`);
      }
      if (!slots[i].link.trim()) {
        setCurrent(i);
        return setFormError(`Banner ${i + 1}: choose where it goes.`);
      }
    }
    if (values.starts_on && values.ends_on && values.ends_on < values.starts_on) return setFormError("The end date is before the start date.");

    const form = new FormData();
    form.append("data", JSON.stringify({ ...values, slots: slots.slice(0, count) }));
    files.slice(0, count).forEach((f, i) => f && form.append(`image_${i}`, f));

    try {
      setSaving(true);
      if (editing === "new") await api.post("/admin/promos", form);
      else await api.put(`/admin/promos/${editing}`, form);
      await load();
      notify(editing === "new" ? "Promo section added" : "Promo section updated");
      close();
    } catch (err) {
      setFormError(apiError(err, "We couldn't save this promo section."));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (sec) => {
    try {
      await api.put(`/admin/promos/${sec.id}/active`, { active: !sec.active });
      setSections((list) => list.map((x) => (x.id === sec.id ? { ...x, active: !sec.active } : x)));
      notify(sec.active ? "Promo section hidden" : "Promo section is live on the home page");
    } catch (err) {
      notify(apiError(err, "We couldn't change this promo section."), "error");
    }
  };

  const move = async (index, dir) => {
    const to = index + dir;
    if (to < 0 || to >= sections.length || busy) return;
    const before = sections;
    const next = [...sections];
    [next[index], next[to]] = [next[to], next[index]];
    setSections(next);
    setBusy(true);
    try {
      await api.put("/admin/promos/order", { ids: next.map((x) => x.id) });
    } catch (err) {
      setSections(before);
      notify(apiError(err, "We couldn't save the new order."), "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (sec) => {
    const ok = await confirm({
      title: "Delete promo section?",
      message: "The section and its pictures will be removed. To keep it for later, hide it instead.",
      confirmLabel: "Delete section",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/admin/promos/${sec.id}`);
      if (editing === sec.id) close();
      await load();
      notify("Promo section deleted");
    } catch (err) {
      notify(apiError(err, "We couldn't delete this promo section."), "error");
    }
  };

  // The row of banners, as the home page draws it; click a banner to edit it, an empty one to add its picture
  const slotViews = Array.from({ length: count }, (_, i) => (
    <div key={i} className={`hp-promo ad-promo-slot ${current === i ? "is-selected" : ""}`}>
      {image(i) ? (
        <div
          role="button"
          tabIndex={0}
          className="ad-promo-slot__pick"
          aria-label={`Edit banner ${i + 1}`}
          onClick={() => setCurrent(i)}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setCurrent(i))}
        >
          <BannerSlide banner={slots[i]} image={image(i)} preview placeholder={false} aspect={PROMO_ASPECT[values.layout]} />
        </div>
      ) : (
        <label className="ad-promo-slot__empty" onClick={() => setCurrent(i)}>
          <input type="file" accept={IMAGE_TYPES.join(",")} onChange={pickFile(i)} hidden />
          <AddPhotoAlternateOutlinedIcon />
          <strong>Add picture {count > 1 ? i + 1 : ""}</strong>
          <span>{layout.size} px</span>
        </label>
      )}
      {count > 1 && <span className="ad-promo-slot__num">{i + 1}</span>}
    </div>
  ));

  const slot = slots[current];

  return (
    <>
      {error && <div className="mt-alert mt-alert--error">{error}</div>}

      {/* ===== Add / edit ===== */}
      {editing !== null && (
        <form ref={formRef} className="mt-panel ad-banner-form ad-promo-form" onSubmit={save} noValidate>
          <div className="ad-panel-head">
            <h2>{editing === "new" ? "New promo section" : "Edit promo section"}</h2>
          </div>

          <div className="ad-panel-body">
            {/* 1. Layout and place on the page */}
            <div className="ad-promo-setup">
              <div className="ad-promo-setup__group">
                <span className="ad-seg-field__label">Layout</span>
                <div className="ad-layouts" role="radiogroup" aria-label="Layout">
                  {LAYOUTS.map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      role="radio"
                      aria-checked={values.layout === l.value}
                      className={`ad-layout ${values.layout === l.value ? "is-active" : ""}`}
                      onClick={() => chooseLayout(l.value)}
                    >
                      <span className={`ad-layout__pic ad-layout__pic--${l.value}`} aria-hidden="true">
                        {Array.from({ length: l.count }, (_, i) => (
                          <i key={i} />
                        ))}
                      </span>
                      <strong>{l.label}</strong>
                      <small>
                        {l.size} px{l.count > 1 ? " each" : ""}
                      </small>
                    </button>
                  ))}
                </div>
              </div>

              <label className="mt-field ad-promo-setup__spot">
                <span>Where on the home page</span>
                <select value={values.position} onChange={(e) => setSection({ position: e.target.value })}>
                  {SPOTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                  {categories.length > 0 && (
                    <optgroup label="After a category row">
                      {categories.map((c) => (
                        <option key={c.id} value={`cat:${c.name}`}>
                          After the {c.name} row
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value="bottom">At the bottom of the page</option>
                </select>
                <small className="ad-hint">A category row with fewer than 2 products isn't shown; then the section moves to the bottom.</small>
              </label>
            </div>

            {/* 2. Live preview */}
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
                <small className="ad-hint">{count > 1 ? "Click a banner to edit it, or an empty box to add its picture." : "Click the empty box to add the picture."}</small>
              </div>
              {device === "computer" ? (
                <ScaledStage interactive>
                  <section className={`hp-promos hp-promos--${values.layout}`}>{slotViews}</section>
                </ScaledStage>
              ) : (
                <div className="ad-bprev ad-bprev--phone">
                  <div className="ad-bprev__phone mt-scope is-interactive">
                    <section className={`hp-promos hp-promos--${values.layout}`}>{slotViews}</section>
                  </div>
                </div>
              )}
              <small className="ad-hint">
                Live preview: on computers this is exactly what customers see (bigger or smaller). On phones the banners stack with a slim line of text under
                each picture{values.layout !== "wide" ? "; the banners become a sideways swipe row with dots" : ""}.
              </small>
            </div>

            {/* 3. The selected banner */}
            <div className="ad-promo-editor">
              {count > 1 && (
                <div className="ad-promo-tabs" role="tablist" aria-label="Banners in this section">
                  {Array.from({ length: count }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      role="tab"
                      aria-selected={current === i}
                      className={current === i ? "is-active" : ""}
                      onClick={() => setCurrent(i)}
                    >
                      {image(i) ? <img src={image(i)} alt="" /> : <AddPhotoAlternateOutlinedIcon fontSize="small" />}
                      Banner {i + 1}
                      {!image(i) && <em>needs a picture</em>}
                    </button>
                  ))}
                </div>
              )}

              <div className="ad-promo-picture">
                <label className={`mt-btn mt-btn--sm ${image(current) ? "mt-btn--secondary" : "mt-btn--primary"}`}>
                  <input type="file" accept={IMAGE_TYPES.join(",")} onChange={pickFile(current)} hidden />
                  <AddPhotoAlternateOutlinedIcon /> {image(current) ? "Replace picture" : "Choose picture"}
                </label>
                <small className="ad-hint">
                  Best size: <strong>{layout.size} px</strong> (for example a Canva custom size); then nothing is trimmed.
                </small>
              </div>

              <div className="ad-form-row">
                <label className="mt-field">
                  <span>Headline (optional)</span>
                  <input value={slot.title} onChange={(e) => setSlot(current, { title: e.target.value })} maxLength={120} placeholder="e.g. Gaming chairs from $229" />
                </label>
                <label className="mt-field">
                  <span>Small line above (optional)</span>
                  <input value={slot.eyebrow} onChange={(e) => setSlot(current, { eyebrow: e.target.value })} maxLength={60} placeholder="e.g. This week only" />
                </label>
              </div>

              <label className="mt-field">
                <span>Short text under the headline (optional)</span>
                <input value={slot.subtitle} onChange={(e) => setSlot(current, { subtitle: e.target.value })} maxLength={220} placeholder="e.g. Corsair and Razer, ready to ship." />
              </label>

              <div className="ad-form-row">
                <label className="mt-field">
                  <span>Button text (optional)</span>
                  <input value={slot.button_text} onChange={(e) => setSlot(current, { button_text: e.target.value })} maxLength={40} placeholder="e.g. Shop now (or leave empty)" />
                </label>
                <LinkField label="Goes to" value={slot.link} onChange={(link) => setSlot(current, { link })} categories={categories} />
              </div>
              <small className="ad-hint">
                The whole banner is clickable. No text at all? Then the picture alone is the link, handy for pictures made in Canva with the text already on them.
              </small>

              <DesignFields values={slot} onChange={(change) => setSlot(current, change)} image={image(current)} aspect={PROMO_ASPECT[values.layout]} />
            </div>

            {/* 4. When */}
            <div className="ad-banner-design">
              <h3 className="ad-banner-design__title">Schedule (optional)</h3>
              <div className="ad-form-row">
                <label className="mt-field">
                  <span>Show from</span>
                  <input type="date" value={values.starts_on} onChange={(e) => setSection({ starts_on: e.target.value })} />
                </label>
                <label className="mt-field">
                  <span>Show until</span>
                  <input type="date" value={values.ends_on} min={values.starts_on || undefined} onChange={(e) => setSection({ ends_on: e.target.value })} />
                </label>
              </div>
              <small className="ad-hint">For a sale or a launch: the whole section turns on and off by itself. Leave empty to show it all the time.</small>
            </div>

            <label className="ad-switch">
              <input type="checkbox" checked={values.active} onChange={(e) => setSection({ active: e.target.checked })} />
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
              {saving ? "Saving…" : editing === "new" ? "Add promo section" : "Save changes"}
            </button>
          </div>
        </form>
      )}

      {/* ===== List ===== */}
      <section className="mt-panel">
        <div className="ad-panel-head ad-promo-listhead">
          <h2>Promo sections</h2>
          {editing === null && sections.length > 0 && (
            <button type="button" className="mt-btn mt-btn--primary mt-btn--sm" onClick={openNew}>
              <AddIcon /> Add promo section
            </button>
          )}
        </div>
        {loading ? (
          <div className="ad-panel-body" style={{ display: "grid", gap: 10 }}>
            {[0, 1].map((i) => (
              <div key={i} className="mt-skeleton" style={{ height: 90, borderRadius: 12 }} />
            ))}
          </div>
        ) : sections.length === 0 ? (
          <div className="mt-empty">
            <div className="mt-empty__icon">
              <DashboardCustomizeOutlinedIcon fontSize="inherit" />
            </div>
            <h3>No promo sections yet</h3>
            <p>Add a row of 1, 2 or 3 banners between the sections of your home page, for a sale, a brand or a category.</p>
            {editing === null && (
              <button type="button" className="mt-btn mt-btn--primary" onClick={openNew}>
                <AddIcon /> Add promo section
              </button>
            )}
          </div>
        ) : (
          <ul className="ad-banners">
            {sections.map((sec, i) => {
              const titles = sec.slots.map((b) => b.title).filter(Boolean);
              return (
                <li key={sec.id} className={`ad-banner-row ${sec.active ? "" : "is-hidden"}`}>
                  <div className="ad-row-actions ad-order">
                    <span className="ad-order__pos">{i + 1}</span>
                    <button type="button" className="ad-icon-btn" onClick={() => move(i, -1)} disabled={i === 0 || busy} aria-label="Move up" title="Move up">
                      <ArrowUpwardIcon />
                    </button>
                    <button type="button" className="ad-icon-btn" onClick={() => move(i, 1)} disabled={i === sections.length - 1 || busy} aria-label="Move down" title="Move down">
                      <ArrowDownwardIcon />
                    </button>
                  </div>
                  <div className={`ad-promo-thumb ad-promo-thumb--${sec.layout}`}>
                    {sec.slots.map((b) => (
                      <img key={b.id} src={imageUrl(b.image)} alt="" />
                    ))}
                  </div>
                  <div className="ad-banner-row__text">
                    <strong>{titles.length ? titles.join(" · ") : "Pictures only"}</strong>
                    <small>
                      {layoutOf(sec.layout).label} · {spotLabel(sec.position)}
                    </small>
                    {(sec.starts_on || sec.ends_on) && (
                      <small className={`ad-banner-row__when ${sec.has_ended ? "is-ended" : sec.not_started ? "is-later" : ""}`}>
                        {sec.has_ended
                          ? `Ended ${formatDay(sec.ends_on)}`
                          : sec.not_started
                          ? `Starts ${formatDay(sec.starts_on)}${sec.ends_on ? ` · until ${formatDay(sec.ends_on)}` : ""}`
                          : sec.ends_on
                          ? `Showing until ${formatDay(sec.ends_on)}`
                          : `Showing since ${formatDay(sec.starts_on)}`}
                      </small>
                    )}
                  </div>
                  <label className="ad-switch ad-banner-row__switch" title={sec.active ? "Live on the home page" : "Hidden"}>
                    <input type="checkbox" checked={!!sec.active} onChange={() => toggleActive(sec)} aria-label="Show this section on the home page" />
                    <span>{sec.active ? "Live" : "Hidden"}</span>
                  </label>
                  <div className="ad-row-actions">
                    <button type="button" className="ad-icon-btn" onClick={() => openEdit(sec)} aria-label="Edit section" title="Edit">
                      <EditOutlinedIcon />
                    </button>
                    <button type="button" className="ad-icon-btn ad-icon-btn--danger" onClick={() => remove(sec)} aria-label="Delete section" title="Delete">
                      <DeleteOutlineIcon />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

export default PromoSections;
