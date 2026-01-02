import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../api";

const UpdatePlace = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [place, setPlace] = useState({
    name: "",
    address: "",
    tel: "",
    image: "",
  });

  const [file, setFile] = useState(null);

  useEffect(() => {
    api.get(`/places/search/${id}`).then((res) => {
      setPlace(res.data[0]);
    });
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("name", place.name);
    formData.append("address", place.address);
    formData.append("tel", place.tel);

    if (file) formData.append("image", file);
    else formData.append("existingImage", place.image);

    await api.post(`/places/modify/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    navigate("/places/admin");
  };

  return (
    <div style={{ maxWidth: 450, margin: "40px auto" }}>
      <h2>Update Place</h2>

      <form onSubmit={handleSubmit}>
        <input
          value={place.name}
          onChange={(e) => setPlace({ ...place, name: e.target.value })}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <input
          value={place.address}
          onChange={(e) => setPlace({ ...place, address: e.target.value })}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <input
          value={place.tel}
          onChange={(e) => setPlace({ ...place, tel: e.target.value })}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        <br /><br />

        {place.image && (
          <img
            src={`http://localhost:5000/images/${place.image}`}
            alt="current"
            width="120"
            style={{ borderRadius: 10 }}
          />
        )}

        <br /><br />
        <button type="submit">Update</button>
        <div style={{ marginTop: 10 }}>
          <Link to="/places/admin">Back</Link>
        </div>
      </form>
    </div>
  );
};

export default UpdatePlace;
