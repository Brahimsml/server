import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "../Styles/admin.css"; // ✅ same admin css

const AdminPlaces = () => {
  const [places, setPlaces] = useState([]);

  const fetchPlaces = async () => {
    const res = await api.get("https://server-2plo.onrender.com/places"); // GET public
    setPlaces(res.data);
  };

  useEffect(() => {
    fetchPlaces();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this place?")) return;
    await api.delete(`/places/${id}`); // token auto
    fetchPlaces();
  };

  const logout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("admin");
    window.location.href = "/admin/login";
  };

  return (
    <div className="admin-page">
      <div className="admin-container">
        {/* Header */}
        <div className="admin-header">
          <div className="admin-title">
            <h1>Places Admin</h1>
            <p>Manage store locations</p>
          </div>

          <div className="admin-actions">
            <Link to="/places/add">
              <button className="btn btn-primary">+ Add Place</button>
            </Link>
            <button className="btn btn-ghost" onClick={logout}>
              Logout
            </button>
          </div>
        </div>

        {/* Table Panel */}
        <div className="panel">
          <div className="panel-header">
            <h2>All Places</h2>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Name</th>
                  <th>Address</th>
                  <th>Tel</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {places.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.image ? (
                        <img
                          src={`https://server-2plo.onrender.com/images/${p.image}`}
                          alt={p.name}
                          style={{
                            width: 80,
                            height: 60,
                            objectFit: "cover",
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.15)",
                            background: "rgba(255,255,255,0.06)",
                          }}
                        />
                      ) : (
                        <span className="badge">No image</span>
                      )}
                    </td>

                    <td>
                      <b>{p.name}</b>
                    </td>
                    <td>{p.address}</td>
                    <td>{p.tel}</td>

                    <td style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(p.id)}
                      >
                        Delete
                      </button>

                      <Link to={`/places/update/${p.id}`}>
                        <button className="btn btn-sm btn-success">
                          Update
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))}

                {places.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", padding: 20 }}>
                      <span className="badge">No places</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ height: 20 }} />
      </div>
    </div>
  );
};

export default AdminPlaces;
