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
import api from "../api";
import { useAdmin } from "../Components/admin/AdminLayout";
import { PageHeader, apiError } from "../Components/admin/AdminUI";

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
    </>
  );
}

export default AdminCategories;
