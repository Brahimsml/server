import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import api from "../../api";
import { PageHeader, apiError } from "./AdminUI";
import { imageUrl } from "../../utils/shop";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_MB = 5;

// Rough box around Lebanon, used to warn about mistyped coordinates
export const inLebanon = (lat, lng) => {
  const a = Number(lat);
  const b = Number(lng);
  return a >= 33.0 && a <= 34.75 && b >= 35.05 && b <= 36.65;
};

const EMPTY = { name: "", address: "", tel: "", lat: "", lng: "" };

/*
  Shared form for "Add store" and "Edit store".
  placeId: edit that store; leave empty to create a new one.
*/
const PlaceForm = ({ placeId }) => {
  const navigate = useNavigate();
  const isEdit = !!placeId;

  const [values, setValues] = useState(EMPTY);
  const [existingImage, setExistingImage] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/places/search/${placeId}`)
      .then((res) => {
        const p = res.data?.[0];
        if (!p) {
          setFormError("This store doesn't exist any more.");
          return;
        }
        setValues({
          name: p.name || "",
          address: p.address || "",
          tel: p.tel || "",
          lat: p.lat ?? "",
          lng: p.lng ?? "",
        });
        setExistingImage(p.image || "");
      })
      .catch(() => setFormError("We couldn't load this store."))
      .finally(() => setLoading(false));
  }, [isEdit, placeId]);

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

  const lat = Number(values.lat);
  const lng = Number(values.lng);
  const coordsValid =
    values.lat !== "" && values.lng !== "" &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  const validate = () => {
    const e = {};
    if (!values.name.trim()) e.name = "Enter the store name.";
    if (!values.address.trim()) e.address = "Enter the address.";
    if (!values.tel.trim()) e.tel = "Enter a phone number.";
    if (values.lat === "" || !Number.isFinite(lat) || Math.abs(lat) > 90) e.lat = "Enter a latitude between -90 and 90.";
    if (values.lng === "" || !Number.isFinite(lng) || Math.abs(lng) > 180) e.lng = "Enter a longitude between -180 and 180.";
    if (!isEdit && !file) e.image = "Add a photo of the store.";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    const formData = new FormData();
    formData.append("name", values.name.trim());
    formData.append("address", values.address.trim());
    formData.append("tel", values.tel.trim());
    formData.append("lat", values.lat);
    formData.append("lng", values.lng);
    if (file) formData.append("image", file);
    else if (isEdit) formData.append("existingImage", existingImage);

    try {
      setSaving(true);
      if (isEdit) await api.post(`/places/modify/${placeId}`, formData);
      else await api.post("/places", formData);

      navigate("/places/admin", {
        state: { notice: isEdit ? `"${values.name.trim()}" was updated` : `"${values.name.trim()}" was added` },
      });
    } catch (err) {
      console.error(err);
      setFormError(apiError(err, "We couldn't save this store. Please try again."));
      setSaving(false);
    }
  };

  const fieldClass = (name) => `mt-field ${errors[name] ? "mt-field--invalid" : ""}`;
  const shownImage = preview || (existingImage ? imageUrl(existingImage) : "");

  return (
    <>
      <PageHeader
        back={{ to: "/places/admin", label: "Stores" }}
        title={isEdit ? "Edit store" : "Add store"}
        subtitle={isEdit ? values.name || " " : "Add a store location customers can visit."}
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
                  <h2>Store details</h2>
                </div>
                <div className="ad-panel-body">
                  <label className={fieldClass("name")}>
                    <span>Store name</span>
                    <input value={values.name} onChange={set("name")} placeholder="e.g. MegaTech Beirut" />
                    {errors.name && <small className="mt-field__error">{errors.name}</small>}
                  </label>

                  <label className={fieldClass("address")}>
                    <span>Address</span>
                    <input value={values.address} onChange={set("address")} placeholder="Street, building, city" />
                    {errors.address && <small className="mt-field__error">{errors.address}</small>}
                  </label>

                  <label className={fieldClass("tel")} style={{ marginBottom: 0 }}>
                    <span>Phone</span>
                    <input type="tel" value={values.tel} onChange={set("tel")} placeholder="e.g. 01 234 567" />
                    {errors.tel && <small className="mt-field__error">{errors.tel}</small>}
                  </label>
                </div>
              </section>

              <section className="mt-panel">
                <div className="ad-panel-head">
                  <div>
                    <h2>Map position</h2>
                    <p>In Google Maps, right-click the store and click the numbers to copy them.</p>
                  </div>
                </div>
                <div className="ad-panel-body">
                  <div className="ad-form-row">
                    <label className={fieldClass("lat")}>
                      <span>Latitude</span>
                      <input type="number" step="any" value={values.lat} onChange={set("lat")} placeholder="e.g. 33.8938" />
                      {errors.lat && <small className="mt-field__error">{errors.lat}</small>}
                    </label>
                    <label className={fieldClass("lng")}>
                      <span>Longitude</span>
                      <input type="number" step="any" value={values.lng} onChange={set("lng")} placeholder="e.g. 35.5018" />
                      {errors.lng && <small className="mt-field__error">{errors.lng}</small>}
                    </label>
                  </div>

                  {coordsValid ? (
                    <>
                      <div className="ad-map">
                        <iframe
                          title="Map preview"
                          src={`https://www.google.com/maps?q=${lat},${lng}&hl=en&z=15&output=embed`}
                          loading="lazy"
                        />
                      </div>
                      {!inLebanon(lat, lng) && (
                        <small className="ad-hint ad-hint--warn">
                          This position is outside Lebanon. Check that latitude and longitude are correct.
                        </small>
                      )}
                    </>
                  ) : (
                    <div className="ad-map ad-map--empty">Enter latitude and longitude to preview the map.</div>
                  )}
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
                      <img className="ad-upload__preview ad-upload__preview--cover" src={shownImage} alt="Store preview" />
                    ) : (
                      <AddPhotoAlternateOutlinedIcon />
                    )}
                    <strong>{shownImage ? "Click to replace the photo" : "Click to upload a photo"}</strong>
                    <small>JPG, PNG, WEBP or GIF · up to {MAX_IMAGE_MB} MB · a wide shot of the store front</small>
                  </label>
                  {file && <span className="ad-upload-name">Selected: {file.name}</span>}
                  {errors.image && <small className="mt-field__error">{errors.image}</small>}
                </div>
              </section>
            </div>
          </div>

          <div className="ad-form-actions">
            <Link to="/places/admin" className="mt-btn mt-btn--secondary">
              Cancel
            </Link>
            <button type="submit" className="mt-btn mt-btn--primary" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add store"}
            </button>
          </div>
        </form>
      )}
    </>
  );
};

export default PlaceForm;
