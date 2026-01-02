import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";

const AddPlace = () => {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [tel, setTel] = useState("");
  const [file, setFile] = useState(null);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("address", address);
      formData.append("tel", tel);
      formData.append("image", file);

      await api.post("/places", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      navigate("/places/admin");
    } catch (err) {
      console.error("Add place error:", err);
      alert(err?.response?.data?.message || "Failed to add place");
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="panel" style={{ maxWidth: 520, margin: "0 auto" }}>
          <div className="panel-header">
            <h2>Add New Place</h2>
            <Link to="/places/admin" className="btn btn-ghost btn-sm">
              ← Back
            </Link>
          </div>

          <div className="panel-body">
            <form onSubmit={handleSubmit} className="form-grid">
              {/* Name */}
              <div className="field f-12">
                <label>Place Name</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Enter place name"
                />
              </div>

              {/* Address */}
              <div className="field f-12">
                <label>Address</label>
                <input
                  className="input"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                  placeholder="Enter address"
                />
              </div>

              {/* Tel */}
              <div className="field f-12">
                <label>Telephone</label>
                <input
                  className="input"
                  value={tel}
                  onChange={(e) => setTel(e.target.value)}
                  required
                  placeholder="Phone number"
                />
              </div>

              {/* Image */}
              <div className="field f-12">
                <label>Image</label>
                <input
                  className="input"
                  type="file"
                  onChange={(e) => setFile(e.target.files[0])}
                  required
                />
              </div>

              {/* Actions */}
              <div className="f-12" style={{ display: "flex", gap: 10 }}>
                <button type="submit" className="btn btn-success btn-block">
                  Add Place
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddPlace;
