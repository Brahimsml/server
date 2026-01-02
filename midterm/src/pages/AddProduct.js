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
    <div style={{ maxWidth: 420, margin: "40px auto" }}>
      <h1>Add Product</h1>

      <form onSubmit={handleSubmit}>
        <CategoryComboBox value={categoryId} onSelectChange={setCategoryId} />
        <br /><br />

        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <br /><br />

        <input placeholder="Price (number)" value={price} onChange={(e) => setPrice(e.target.value)} />
        <br /><br />

        <input placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <br /><br />

        <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <br /><br />

        <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        <br /><br />

        <button type="submit">Save</button>
        <br /><br />

        <Link to="/products/admin">Back</Link>
      </form>
    </div>
  );
}

export default AddProduct;
