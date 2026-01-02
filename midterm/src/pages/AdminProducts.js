import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

function AdminProducts() {
  const [products, setProducts] = useState([]);

  const fetchProducts = async () => {
    const res = await api.get("/products"); // GET public
    setProducts(res.data);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleDelete = async (id) => {
    await api.delete(`/products/${id}`); //  token sent automatically
    fetchProducts();
  };

  const logout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("admin");
    window.location.href = "/admin/login";
  };

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ textAlign: "center" }}>Products Admin</h1>

      <div style={{ display: "flex", gap: 10, marginBottom: 15 }}>
        <Link to="/products/add">
          <button>Add Product</button>
        </Link>
        <button onClick={logout}>Logout</button>
      </div>

      <table border="1" width="100%" cellPadding="10">
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
                {p.image && (
                  <img
                    src={`http://localhost:5000/images/${p.image}`}
                    alt={p.name}
                    width="70"
                    style={{ borderRadius: 8 }}
                  />
                )}
              </td>
              <td>{p.name}</td>
              <td>{p.category_name}</td>
              <td>${Number(p.price || 0).toFixed(2)}</td>
              <td>{p.label || "-"}</td>
              <td>
                <button onClick={() => handleDelete(p.id)}>Delete</button>{" "}
                <Link to={`/products/update/${p.id}`}>
                  <button>Update</button>
                </Link>
              </td>
            </tr>
          ))}

          {products.length === 0 && (
            <tr>
              <td colSpan="6" style={{ textAlign: "center", padding: 20 }}>
                No products
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default AdminProducts;
