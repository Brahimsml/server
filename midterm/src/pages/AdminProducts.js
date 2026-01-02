import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "../Styles/admin.css" // ✅ IMPORTANT: adjust path if needed (ex: "../styles/admin.css")

function AdminProducts() {
  const [products, setProducts] = useState([]);

  const fetchProducts = async () => {
    const res = await api.get("https://server-2plo.onrender.com/products"); // GET public
    setProducts(res.data);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleDelete = async (id) => {
    await api.delete(`/products/${id}`); // token sent automatically
    fetchProducts();
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
            <h1>Products Admin</h1>
            <p>Manage products (Add / Update / Delete)</p>
          </div>

          <div className="admin-actions">
            <Link to="/products/add">
              <button className="btn btn-primary">+ Add Product</button>
            </Link>
            <button className="btn btn-ghost" onClick={logout}>
              Logout
            </button>
          </div>
        </div>

        {/* Table Panel */}
        <div className="panel">
          <div className="panel-header">
            <h2>All Products</h2>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Label</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.image ? (
                        <img
                          src={`https://server-2plo.onrender.com/images/${p.image}`}
                          alt={p.name}
                          style={{
                            width: 70,
                            height: 70,
                            objectFit: "cover",
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.12)",
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
                    <td>{p.category_name}</td>
                    <td>${Number(p.price || 0).toFixed(2)}</td>

                    <td>
                      {p.label ? (
                        <span
                          className={`badge ${
                            p.label === "Hot"
                              ? "badge-hot"
                              : p.label === "New"
                              ? "badge-new"
                              : ""
                          }`}
                        >
                          {p.label}
                        </span>
                      ) : (
                        <span className="badge">-</span>
                      )}
                    </td>

                    <td style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(p.id)}
                      >
                        Delete
                      </button>

                      <Link to={`/products/update/${p.id}`}>
                        <button className="btn btn-sm btn-success">Update</button>
                      </Link>
                    </td>
                  </tr>
                ))}

                {products.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: "center", padding: 20 }}>
                      <span className="badge">No products</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Small footer spacing */}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

export default AdminProducts;
