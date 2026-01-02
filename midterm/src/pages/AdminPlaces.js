import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

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
    await api.delete(`/places/${id}`); //  token sent automatically
    fetchPlaces();
  };

  const logout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("admin");
    window.location.href = "/admin/login";
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Admin – Places</h2>

      <div style={{ display: "flex", gap: 10, marginBottom: 15 }}>
        <Link to="/places/add">
          <button>Add New Place</button>
        </Link>
        <button onClick={logout}>Logout</button>
      </div>

      <table border="1" width="100%" cellPadding="8">
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
                {p.image && (
                  <img
                    src={`http://localhost:5000/images/${p.image}`}
                    width="80"
                    alt=""
                    style={{ borderRadius: 8 }}
                  />
                )}
              </td>
              <td>{p.name}</td>
              <td>{p.address}</td>
              <td>{p.tel}</td>
              <td>
                <button onClick={() => handleDelete(p.id)}>Delete</button>{" "}
                <Link to={`/places/update/${p.id}`}>
                  <button>Update</button>
                </Link>
              </td>
            </tr>
          ))}

          {places.length === 0 && (
            <tr>
              <td colSpan="5" style={{ textAlign: "center", padding: 20 }}>
                No places
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default AdminPlaces;
