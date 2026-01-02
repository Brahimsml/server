import { useEffect, useState } from "react";

function CategoryComboBox({ value, onSelectChange }) {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5000/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data))
      .catch(console.log);
  }, []);

  return (
    <select value={value || ""} onChange={(e) => onSelectChange(e.target.value)}>
      <option value="">Select Category</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

export default CategoryComboBox;
