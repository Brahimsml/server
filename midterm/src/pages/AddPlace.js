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
      formData.append("image", file); // must be "image"

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
    <div style={{ maxWidth: 450, margin: "40px auto" }}>
      <h2>Add New Place</h2>

      <form onSubmit={handleSubmit}>
        <input
          placeholder="Place name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <input
          placeholder="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <input
          placeholder="Tel"
          value={tel}
          onChange={(e) => setTel(e.target.value)}
          required
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <input
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
          required
          style={{ width: "100%", marginBottom: 15 }}
        />

        <button type="submit" style={{ padding: 10, width: "100%" }}>
          Add Place
        </button>

        <div style={{ marginTop: 10 }}>
          <Link to="/places/admin">Back</Link>
        </div>
      </form>
    </div>
  );
};

export default AddPlace;
