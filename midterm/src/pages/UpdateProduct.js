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

  useEffect(() => {
    api.get(`/products/search/${id}`).then((res) => {
      const p = res.data[0];
      setCategoryId(String(p.category_id));
      setName(p.name);
      setPrice(p.price);
      setLabel(p.label || "");
      setDescription(p.description || "");
      setExistingImage(p.image || "");
    });
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("category_id", categoryId);
    formData.append("name", name);
    formData.append("price", price);
    formData.append("label", label);
    formData.append("description", description);

    if (file) formData.append("image", file);
    else formData.append("existingImage", existingImage);

    await api.post(`/products/modify/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    navigate("/products/admin");
  };

  return (
    <div style={{ maxWidth: 420, margin: "40px auto" }}>
      <h1>Update Product</h1>

      <form onSubmit={handleSubmit}>
        <CategoryComboBox value={categoryId} onSelectChange={setCategoryId} />
        <br /><br />

        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        <br /><br />

        <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" />
        <br /><br />

        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" />
        <br /><br />

        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
        <br /><br />

        <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        <br /><br />

        {existingImage && (
          <img
            src={`http://localhost:5000/images/${existingImage}`}
            alt="current"
            width="120"
            style={{ borderRadius: 10 }}
          />
        )}

        <br /><br />
        <button type="submit">Update</button>
        <br /><br />
        <Link to="/products/admin">Back</Link>
      </form>
    </div>
  );
}

export default UpdateProduct;
