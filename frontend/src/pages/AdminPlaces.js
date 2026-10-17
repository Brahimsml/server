import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import api from "../api";
import { useAdmin } from "../Components/admin/AdminLayout";
import { PageHeader, apiError } from "../Components/admin/AdminUI";
import { inLebanon } from "../Components/admin/PlaceForm";
import { imageUrl, onImageError, FALLBACK_IMG } from "../utils/shop";

const AdminPlaces = () => {
  const { notify, confirm } = useAdmin();
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/places")
      .then((res) => setPlaces(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error("Failed to fetch places:", err);
        setError("We couldn't load your stores. Please refresh the page.");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (place) => {
    const ok = await confirm({
      title: "Delete store?",
      message: `"${place.name}" will be removed from the Locations page. This can't be undone.`,
      confirmLabel: "Delete store",
      danger: true,
    });
    if (!ok) return;

    try {
      await api.delete(`/places/${place.id}`);
      setPlaces((list) => list.filter((p) => p.id !== place.id));
      notify(`"${place.name}" was deleted`);
    } catch (err) {
      console.error(err);
      notify(apiError(err, "We couldn't delete this store."), "error");
    }
  };

  return (
    <>
      <PageHeader
        title="Stores"
        subtitle="The store locations customers see on the Locations page."
        actions={
          <Link to="/places/add" className="mt-btn mt-btn--primary">
            <AddIcon /> Add store
          </Link>
        }
      />

      {error && <div className="mt-alert mt-alert--error">{error}</div>}

      {loading ? (
        <div className="ad-cards">
          {[0, 1, 2].map((i) => (
            <div key={i} className="mt-skeleton" style={{ height: 340 }} />
          ))}
        </div>
      ) : places.length === 0 && !error ? (
        <div className="mt-panel mt-empty">
          <div className="mt-empty__icon">
            <StorefrontOutlinedIcon fontSize="inherit" />
          </div>
          <h3>No stores yet</h3>
          <p>Add your first store so customers can find you.</p>
          <Link to="/places/add" className="mt-btn mt-btn--primary">
            <AddIcon /> Add store
          </Link>
        </div>
      ) : (
        <div className="ad-cards">
          {places.map((p) => {
            const hasCoords = p.lat !== null && p.lat !== "" && p.lng !== null && p.lng !== "";
            const coordsOk = hasCoords && inLebanon(p.lat, p.lng);
            return (
              <article key={p.id} className="ad-store mt-panel">
                <div className="ad-store__img">
                  <img src={imageUrl(p.image) || FALLBACK_IMG} alt="" loading="lazy" onError={onImageError} />
                </div>
                <div className="ad-store__body">
                  <h3>{p.name}</h3>
                  <ul>
                    <li>
                      <PlaceOutlinedIcon /> {p.address || "No address"}
                    </li>
                    <li>
                      <PhoneOutlinedIcon /> {p.tel || "No phone"}
                    </li>
                    <li>
                      <MapOutlinedIcon />
                      {hasCoords ? (
                        <span>
                          {p.lat}, {p.lng}
                          {!coordsOk && (
                            <span className="ad-hint ad-hint--warn">Outside Lebanon: check the map position</span>
                          )}
                        </span>
                      ) : (
                        <span className="ad-hint--warn">No map position</span>
                      )}
                    </li>
                  </ul>
                </div>
                <div className="ad-store__foot">
                  <Link to={`/places/update/${p.id}`} className="mt-btn mt-btn--ghost mt-btn--sm">
                    <EditOutlinedIcon /> Edit
                  </Link>
                  <button
                    type="button"
                    className="ad-icon-btn ad-icon-btn--danger"
                    onClick={() => handleDelete(p)}
                    aria-label={`Delete ${p.name}`}
                    title="Delete"
                  >
                    <DeleteOutlineIcon />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
};

export default AdminPlaces;
