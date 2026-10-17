import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import api from "../../api";
import { PageHeader, apiError } from "./AdminUI";
import { imageUrl } from "../../utils/shop";

const LABELS = ["Best Seller", "New"];
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_MB = 5;

// Old labels were typed by hand ("Best", "New "): map them onto the dropdown values
const cleanLabel = (label) => {
  const l = String(label || "").trim();
  if (!l) return "";
  if (/best/i.test(l)) return "Best Seller";
  if (/^new$/i.test(l)) return "New";
  return l;
};

const EMPTY = { name: "", category_id: "", description: "", price: "", stock_quantity: "0", label: "" };

/*
  Shared form for "Add product" and "Edit product".
  productId: edit that product; leave empty to create a new one.
*/
const ProductForm = ({ productId }) => {
  const navigate = useNavigate();
  const isEdit = !!productId;

  const [values, setValues] = useState(EMPTY);
  const [existingImage, setExistingImage] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [categories, setCategories] = useState([]);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get("/categories")
      .then((res) => setCategories(Array.isArray(res.data) ? res.data : []))
      .catch(() => setFormError("We couldn't load the categories."));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/products/search/${productId}`)
      .then((res) => {
        const p = res.data?.[0];
        if (!p) {
          setFormError("This product doesn't exist any more.");
          return;
        }
        setValues({
          name: p.name || "",
          category_id: String(p.category_id || ""),
          description: p.description || "",
          price: String(p.price ?? ""),
          stock_quantity: String(p.stock_quantity ?? 0),
          label: cleanLabel(p.label),
        });
        setExistingImage(p.image || "");
      })
      .catch(() => setFormError("We couldn't load this product."))
      .finally(() => setLoading(false));
  }, [isEdit, productId]);

  // Free the preview URL when it changes / on leave
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const set = (name) => (e) => {
    setValues((v) => ({ ...v, [name]: e.target.value }));
    setErrors((er) => ({ ...er, [name]: undefined }));
  };

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;

    if (!IMAGE_TYPES.includes(f.type)) {
      setErrors((er) => ({ ...er, image: "Please choose a JPG, PNG, WEBP or GIF image." }));
      return;
    }
    if (f.size > MAX_IMAGE_MB * 1024 * 1024) {
      setErrors((er) => ({ ...er, image: `The image must be ${MAX_IMAGE_MB} MB or smaller.` }));
      return;
    }
    setErrors((er) => ({ ...er, image: undefined }));
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const validate = () => {
    const e = {};
    if (!values.name.trim()) e.name = "Enter a product name.";
    if (!values.category_id) e.category_id = "Choose a category.";
    const price = Number(values.price);
    if (values.price === "" || !Number.isFinite(price) || price <= 0) e.price = "Enter a price above 0.";
    const stock = Number(values.stock_quantity);
    if (!Number.isInteger(stock) || stock < 0) e.stock_quantity = "Enter a whole number, 0 or more.";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    const formData = new FormData();
    formData.append("category_id", values.category_id);
    formData.append("name", values.name.trim());
    formData.append("price", values.price);
    formData.append("label", values.label);
    formData.append("description", values.description.trim());
    formData.append("stock_quantity", values.stock_quantity);
    if (file) formData.append("image", file);
    else if (isEdit) formData.append("existingImage", existingImage);

    try {
      setSaving(true);
      if (isEdit) await api.post(`/products/modify/${productId}`, formData);
      else await api.post("/products", formData);

      navigate("/products/admin", {
        state: { notice: isEdit ? `"${values.name.trim()}" was updated` : `"${values.name.trim()}" was added` },
      });
    } catch (err) {
      console.error(err);
      setFormError(apiError(err, "We couldn't save this product. Please try again."));
      setSaving(false);
    }
  };

  const fieldClass = (name) => `mt-field ${errors[name] ? "mt-field--invalid" : ""}`;
  const shownImage = preview || (existingImage ? imageUrl(existingImage) : "");
  const customLabel = values.label && !LABELS.includes(values.label);

  return (
    <>
      <PageHeader
        back={{ to: "/products/admin", label: "Products" }}
        title={isEdit ? "Edit product" : "Add product"}
        subtitle={isEdit ? values.name || " " : "Add a new product to the store."}
      />

      {formError && (
        <div className="mt-alert mt-alert--error" role="alert">
          {formError}
        </div>
      )}

      {loading ? (
        <div className="mt-skeleton" style={{ height: 420 }} />
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div className="ad-form">
            <div className="ad-form__col">
              <section className="mt-panel">
                <div className="ad-panel-head">
                  <h2>Details</h2>
                </div>
                <div className="ad-panel-body">
                  <label className={fieldClass("name")}>
                    <span>Name</span>
                    <input value={values.name} onChange={set("name")} placeholder="e.g. NVIDIA RTX 4090" />
                    {errors.name && <small className="mt-field__error">{errors.name}</small>}
                  </label>

                  <label className={fieldClass("category_id")}>
                    <span>Category</span>
                    <select value={values.category_id} onChange={set("category_id")}>
                      <option value="">Choose a category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {errors.category_id && <small className="mt-field__error">{errors.category_id}</small>}
                  </label>

                  <label className="mt-field" style={{ marginBottom: 0 }}>
                    <span>Description</span>
                    <textarea
                      rows={4}
                      value={values.description}
                      onChange={set("description")}
                      placeholder="A short sentence customers see under the product name."
                    />
                  </label>
                </div>
              </section>

              <section className="mt-panel">
                <div className="ad-panel-head">
                  <h2>Price &amp; stock</h2>
                </div>
                <div className="ad-panel-body">
                  <div className="ad-form-row">
                    <label className={fieldClass("price")}>
                      <span>Price (USD)</span>
                      <div className="ad-prefix">
                        <em>$</em>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={values.price}
                          onChange={set("price")}
                          placeholder="0.00"
                        />
                      </div>
                      {errors.price && <small className="mt-field__error">{errors.price}</small>}
                    </label>

                    <label className={fieldClass("stock_quantity")}>
                      <span>Stock quantity</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        value={values.stock_quantity}
                        onChange={set("stock_quantity")}
                      />
                      {errors.stock_quantity && (
                        <small className="mt-field__error">{errors.stock_quantity}</small>
                      )}
                    </label>
                  </div>

                  <label className="mt-field" style={{ marginBottom: 0 }}>
                    <span>Label</span>
                    <select value={values.label} onChange={set("label")}>
                      <option value="">None</option>
                      {LABELS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                      {customLabel && <option value={values.label}>{values.label}</option>}
                    </select>
                    <small className="ad-hint">
                      "Best Seller" products appear in the Best sellers section on the home page.
                    </small>
                  </label>
                </div>
              </section>
            </div>

            <div className="ad-form__col">
              <section className="mt-panel">
                <div className="ad-panel-head">
                  <h2>Photo</h2>
                </div>
                <div className="ad-panel-body">
                  <label className="ad-upload">
                    <input type="file" accept={IMAGE_TYPES.join(",")} onChange={pickFile} />
                    {shownImage ? (
                      <img className="ad-upload__preview" src={shownImage} alt="Product preview" />
                    ) : (
                      <AddPhotoAlternateOutlinedIcon />
                    )}
                    <strong>{shownImage ? "Click to replace the photo" : "Click to upload a photo"}</strong>
                    <small>JPG, PNG, WEBP or GIF · up to {MAX_IMAGE_MB} MB · white background looks best</small>
                  </label>
                  {file && <span className="ad-upload-name">Selected: {file.name}</span>}
                  {errors.image && <small className="mt-field__error">{errors.image}</small>}
                </div>
              </section>
            </div>
          </div>

          <div className="ad-form-actions">
            <Link to="/products/admin" className="mt-btn mt-btn--secondary">
              Cancel
            </Link>
            <button type="submit" className="mt-btn mt-btn--primary" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add product"}
            </button>
          </div>
        </form>
      )}
    </>
  );
};

export default ProductForm;
