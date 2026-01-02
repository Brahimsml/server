import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import CategoryComboBox from "../Components/CategoryComboBox";

function AddProduct() {
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const formData = new FormData();
      formData.append("category_id", categoryId);
      formData.append("name", name);
      formData.append("price", price);
      formData.append("label", label);
      formData.append("description", description);
      if (file) formData.append("image", file);

      await api.post("/products", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      navigate("/products/admin");
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Failed to add product");
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-container">

        <div className="admin-header">
          <div className="admin-title">
            <h1>Add Product</h1>
            <p>Create a new product</p>
          </div>

          <Link to="/products/admin">
            <button className="btn btn-ghost btn-sm">Back</button>
          </Link>
        </div>

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
                />
              </div>

              <div className="field f-6">
                <label>Price</label>
                <input
                  className="input"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
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

              <div className="f-12">
                <button className="btn btn-success btn-block">
                  Save Product
                </button>
              </div>

            </form>

          </div>
        </div>

      </div>
    </div>
  );
}

export default AddProduct;
