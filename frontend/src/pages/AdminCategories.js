import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import api from "../api";
import { useAdmin } from "../Components/admin/AdminLayout";
import { PageHeader, apiError } from "../Components/admin/AdminUI";
import { imageUrl, normalizeLabel, onImageError, FALLBACK_IMG } from "../utils/shop";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_MB = 5;

function AdminCategories() {
  const { notify, confirm } = useAdmin();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  const [picking, setPicking] = useState(null); // the category whose picture is being chosen
  const [pictureBusy, setPictureBusy] = useState(false);
  const [pictureError, setPictureError] = useState("");

  useEffect(() => {
    Promise.all([api.get("/categories"), api.get("/products")])
      .then(([c, p]) => {
        setCategories(Array.isArray(c.data) ? c.data : []);
        setProducts(Array.isArray(p.data) ? p.data : []);
      })
      .catch((err) => {
        console.error(err);
        setError("We couldn't load categories. Please refresh the page.");
      })
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const map = {};
    products.forEach((p) => (map[p.category_id] = (map[p.category_id] || 0) + 1));
    return map;
  }, [products]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      setAddError("Enter a category name.");
      return;
    }
    try {
      setAdding(true);
      const res = await api.post("/categories", { name });
      setCategories((list) => [...list, res.data]); // new categories go to the end
      setNewName("");
      setAddError("");
      notify(`Category "${res.data.name}" was added`);
    } catch (err) {
      setAddError(apiError(err, "We couldn't add this category."));
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (c) => {
    setEditId(c.id);
    setEditName(c.name);
    setEditError("");
  };

  const saveEdit = async (c) => {
    const name = editName.trim();
    if (!name) {
      setEditError("Enter a category name.");
      return;
    }
    if (name === c.name) {
      setEditId(null);
      return;
    }
    try {
      const res = await api.put(`/categories/${c.id}`, { name });
      setCategories((list) =>
        list.map((x) => (x.id === c.id ? { ...x, name: res.data.name } : x))
      );
      setEditId(null);
      notify(`Renamed to "${res.data.name}"`);
    } catch (err) {
      setEditError(apiError(err, "We couldn't rename this category."));
    }
  };

  // Each category's own product photos, and the one the site picks automatically
  // (its priciest labelled product, else its priciest) when no picture is chosen
  const photosOf = (categoryId) =>
    products
      .filter((p) => p.category_id === categoryId && p.image)
      .sort((a, b) => Number(!!normalizeLabel(b.label)) - Number(!!normalizeLabel(a.label)) || Number(b.price) - Number(a.price));
  const autoPicture = (categoryId) => photosOf(categoryId)[0]?.image || "";

  const openPicker = (c) => {
    setPicking(c);
    setPictureError("");
  };

  const savePicture = async (c, { file, fromProduct, automatic }) => {
    setPictureBusy(true);
    setPictureError("");
    try {
      let image = null;
      if (automatic) {
        await api.delete(`/categories/${c.id}/image`);
      } else {
        const form = new FormData();
        if (file) form.append("image", file);
        if (fromProduct) form.append("fromProduct", fromProduct);
        image = (await api.put(`/categories/${c.id}/image`, form)).data.image;
      }
      setCategories((list) => list.map((x) => (x.id === c.id ? { ...x, image } : x)));
      setPicking(null);
      notify(automatic ? `"${c.name}" uses an automatic picture again` : `New picture for "${c.name}" saved`);
    } catch (err) {
      setPictureError(apiError(err, "We couldn't save this picture."));
    } finally {
      setPictureBusy(false);
    }
  };

  const pickFile = (c) => (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setPictureError(`Use a JPG, PNG or WEBP image up to ${MAX_IMAGE_MB} MB.`);
      return;
    }
    savePicture(c, { file });
  };

  // Move a category up or down; the whole site shows categories in this order
  const move = async (index, dir) => {
    const to = index + dir;
    if (to < 0 || to >= categories.length || savingOrder) return;
    const before = categories;
    const next = [...categories];
    [next[index], next[to]] = [next[to], next[index]];
    setCategories(next);
    setSavingOrder(true);
    try {
      await api.put("/categories/order", { ids: next.map((c) => c.id) });
      notify(`"${next[to].name}" moved ${dir < 0 ? "up" : "down"}`);
    } catch (err) {
      setCategories(before);
      notify(apiError(err, "We couldn't save the new order."), "error");
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDelete = async (c) => {
    const ok = await confirm({
      title: "Delete category?",
      message: `"${c.name}" will be removed. This can't be undone.`,
      confirmLabel: "Delete category",
      danger: true,
    });
    if (!ok) return;

    try {
      await api.delete(`/categories/${c.id}`);
      setCategories((list) => list.filter((x) => x.id !== c.id));
      notify(`Category "${c.name}" was deleted`);
    } catch (err) {
      notify(apiError(err, "We couldn't delete this category."), "error");
    }
  };

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="Group your products. Use the arrows to set the order they appear in on the home page, shop and menus."
      />

      {error && <div className="mt-alert mt-alert--error">{error}</div>}

      <div className="ad-form" style={{ gridTemplateColumns: "minmax(0, 760px)" }}>
        <section className="mt-panel">
          <form className="ad-toolbar" onSubmit={handleAdd} noValidate style={{ borderBottom: "none" }}>
            <label className={`mt-field ${addError ? "mt-field--invalid" : ""}`} style={{ flex: "1 1 260px", margin: 0 }}>
              <span>New category</span>
              <input
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setAddError("");
                }}
                placeholder="e.g. Keyboards"
                maxLength={100}
              />
              {addError && <small className="mt-field__error">{addError}</small>}
            </label>
            <button type="submit" className="mt-btn mt-btn--primary" disabled={adding} style={{ alignSelf: "flex-start", marginTop: 26 }}>
              <AddIcon /> {adding ? "Adding…" : "Add category"}
            </button>
          </form>
        </section>

        <section className="mt-panel">
          {loading ? (
            <div className="ad-panel-body" style={{ display: "grid", gap: 10 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="mt-skeleton" style={{ height: 48, borderRadius: 10 }} />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="mt-empty">
              <div className="mt-empty__icon">
                <CategoryOutlinedIcon fontSize="inherit" />
              </div>
              <h3>No categories yet</h3>
              <p>Add one above, then pick it when you add products.</p>
            </div>
          ) : (
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Photo</th>
                    <th>Name</th>
                    <th>Products</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c, i) => {
                    const n = counts[c.id] || 0;
                    const editing = editId === c.id;
                    return (
                      <tr key={c.id}>
                        <td data-label="Order">
                          <div className="ad-row-actions ad-order">
                            <span className="ad-order__pos">{i + 1}</span>
                            <button
                              type="button"
                              className="ad-icon-btn"
                              onClick={() => move(i, -1)}
                              disabled={i === 0 || savingOrder}
                              aria-label={`Move ${c.name} up`}
                              title="Move up"
                            >
                              <ArrowUpwardIcon />
                            </button>
                            <button
                              type="button"
                              className="ad-icon-btn"
                              onClick={() => move(i, 1)}
                              disabled={i === categories.length - 1 || savingOrder}
                              aria-label={`Move ${c.name} down`}
                              title="Move down"
                            >
                              <ArrowDownwardIcon />
                            </button>
                          </div>
                        </td>
                        <td data-label="Photo">
                          <button
                            type="button"
                            className="ad-cat-photo"
                            onClick={() => openPicker(c)}
                            aria-label={`Change the picture for ${c.name}`}
                            title="Change picture"
                          >
                            {c.image || autoPicture(c.id) ? (
                              <img src={imageUrl(c.image || autoPicture(c.id))} alt="" onError={onImageError} />
                            ) : (
                              <AddPhotoAlternateOutlinedIcon />
                            )}
                            {!c.image && <span className="ad-cat-photo__auto">Auto</span>}
                          </button>
                        </td>
                        <td className="ad-cell-full">
                          {editing ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                saveEdit(c);
                              }}
                              className={`mt-field ${editError ? "mt-field--invalid" : ""}`}
                              style={{ margin: 0 }}
                            >
                              <input
                                value={editName}
                                onChange={(e) => {
                                  setEditName(e.target.value);
                                  setEditError("");
                                }}
                                onKeyDown={(e) => e.key === "Escape" && setEditId(null)}
                                maxLength={100}
                                autoFocus
                                aria-label={`New name for ${c.name}`}
                              />
                              {editError && <small className="mt-field__error">{editError}</small>}
                            </form>
                          ) : (
                            <span className="ad-strong">{c.name}</span>
                          )}
                        </td>
                        <td data-label="Products">
                          {n > 0 ? (
                            <Link to={`/shop?category=${encodeURIComponent(c.name)}`} className="mt-link" title="See in the shop">
                              {n} {n === 1 ? "product" : "products"}
                            </Link>
                          ) : (
                            <span className="ad-hint" style={{ margin: 0 }}>
                              Empty
                            </span>
                          )}
                        </td>
                        <td className="ad-actions-cell">
                          <div className="ad-row-actions">
                            {editing ? (
                              <>
                                <button type="button" className="ad-icon-btn" onClick={() => saveEdit(c)} aria-label="Save name" title="Save">
                                  <CheckIcon />
                                </button>
                                <button type="button" className="ad-icon-btn" onClick={() => setEditId(null)} aria-label="Cancel" title="Cancel">
                                  <CloseIcon />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="ad-icon-btn"
                                  onClick={() => startEdit(c)}
                                  aria-label={`Rename ${c.name}`}
                                  title="Rename"
                                >
                                  <EditOutlinedIcon />
                                </button>
                                <button
                                  type="button"
                                  className="ad-icon-btn ad-icon-btn--danger"
                                  onClick={() => handleDelete(c)}
                                  disabled={n > 0}
                                  aria-label={`Delete ${c.name}`}
                                  title={n > 0 ? "Move or delete its products first" : "Delete"}
                                >
                                  <DeleteOutlineIcon />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* ===== Picture picker ===== */}
      {picking && (
        <div className="ad-dialog-backdrop" onClick={() => !pictureBusy && setPicking(null)}>
          <div
            className="ad-dialog ad-picture-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ad-picture-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="ad-picture-title">Picture for {picking.name}</h2>
            <p className="ad-hint" style={{ marginTop: 4 }}>
              Shown on the home page tiles and in the shop menus. A clean product photo on white looks best.
            </p>

            <div className="ad-picture-current">
              <img src={imageUrl(picking.image || autoPicture(picking.id)) || FALLBACK_IMG} alt="" onError={onImageError} />
              <span>{picking.image ? "Chosen picture" : "Automatic (its top product)"}</span>
            </div>

            <label className={`mt-btn mt-btn--primary ad-picture-upload ${pictureBusy ? "is-disabled" : ""}`}>
              <input type="file" accept={IMAGE_TYPES.join(",")} onChange={pickFile(picking)} hidden disabled={pictureBusy} />
              <AddPhotoAlternateOutlinedIcon /> {pictureBusy ? "Saving…" : "Upload a picture"}
            </label>

            {photosOf(picking.id).length > 0 && (
              <>
                <p className="ad-picture-label">Or use one of its product photos</p>
                <div className="ad-picture-grid">
                  {photosOf(picking.id).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`ad-picture-option ${picking.image === p.image ? "is-current" : ""}`}
                      onClick={() => savePicture(picking, { fromProduct: p.image })}
                      disabled={pictureBusy}
                      title={p.name}
                      aria-label={`Use the photo of ${p.name}`}
                    >
                      <img src={imageUrl(p.image)} alt="" onError={onImageError} />
                    </button>
                  ))}
                </div>
              </>
            )}

            {pictureError && (
              <div className="mt-alert mt-alert--error" role="alert" style={{ marginTop: 14 }}>
                {pictureError}
              </div>
            )}

            <div className="ad-picture-actions">
              {picking.image && (
                <button
                  type="button"
                  className="mt-btn mt-btn--secondary"
                  onClick={() => savePicture(picking, { automatic: true })}
                  disabled={pictureBusy}
                >
                  <AutoAwesomeOutlinedIcon /> Use automatic
                </button>
              )}
              <button type="button" className="mt-btn mt-btn--secondary" onClick={() => setPicking(null)} disabled={pictureBusy}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AdminCategories;
