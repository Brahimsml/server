import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../api";
import CategoryComboBox from "../Components/CategoryComboBox";

function UpdateProduct() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [existingImage, setExistingImage] = useState("");
  const [file, setFile] = useState(null);

  // ✅ Load product
  useEffect(() => {
    api.get(`/products/search/${id}`).then((res) => {
      const p = res.data[0];
      setCategoryId(String(p.category_id)); // IMPORTANT
      setName(p.name);
      setPrice(p.price);
      setLabel(p.label || "");
      setDescription(p.description || "");
      setExistingImage(p.image || "");
    });
  }, [id]);

  // ✅ Submit update (WORKING)
  const handleSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("category_id", categoryId);
    formData.append("name", name);
    formData.append("price", price);
    formData.append("label", label);
    formData.append("description", description);

    if (file) {
      formData.append("image", file);
    } else {
      formData.append("existingImage", existingImage);
    }

    await api.post(`/products/modify/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    navigate("/products/admin");
  };

  return (
    <div className="admin-page">
      <div className="admin-container">

        {/* HEADER */}
        <div className="admin-header">
          <div className="admin-title">
            <h1>Update Product</h1>
            <p>Edit product details</p>
          </div>

          <div className="admin-actions">
            <Link to="/products/admin">
              <button className="btn btn-ghost">⬅ Back</button>
            </Link>
          </div>
        </div>

        {/* FORM PANEL */}
        <div className="panel">
          <div className="panel-body">
            <form onSubmit={handleSubmit} className="form-grid">

              <div className="field f-12">
                <label>Category</label>
                <CategoryComboBox
                  value={categoryId}
                  onSelectChange={setCategoryId}
                />
              </div>

              <div className="field f-6">
                <label>Name</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="field f-6">
                <label>Price</label>
                <input
                  className="input"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>

              <div className="field f-6">
                <label>Label</label>
                <input
                  className="input"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>

              <div className="field f-12">
                <label>Description</label>
                <textarea
                  className="textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="field f-12">
                <label>Image</label>
                <input
                  type="file"
                  className="input"
                  onChange={(e) => setFile(e.target.files[0])}
                />
              </div>

              {/* IMAGE PREVIEW */}
              {existingImage && (
                <div className="field f-12">
                  <div className="preview">
                    <img
                      src={`https://server-2plo.onrender.com/images/${existingImage}`}
                      alt="current"
                    />
                    <span>Current Image</span>
                  </div>
                </div>
              )}

              <div className="field f-12">
                <button type="submit" className="btn btn-primary btn-block">
                  Update Product
                </button>
              </div>

            </form>
          </div>
        </div>

      </div>
    </div>
  );
}

export default UpdateProduct;
