import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

function AdminContacts() {
  const [contacts, setContacts] = useState([]);
  const [error, setError] = useState("");

  const fetchContacts = async () => {
    try {
      const res = await api.get("/contacts"); //  protected, token auto sent
      setContacts(res.data);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to load contacts");
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this message?")) return;

    try {
      await api.delete(`/contacts/${id}`); //  protected
      fetchContacts();
    } catch (err) {
      console.error(err);
      alert("Delete failed");
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ textAlign: "center" }}>Contacts Admin</h1>

      <div style={{ display: "flex", gap: 10, marginBottom: 15 }}>
        <Link to="/products/admin"><button>Products</button></Link>
        <Link to="/places/admin"><button>Places</button></Link>
        <Link to="/orders/admin"><button>Orders</button></Link>
      </div>

      {error && (
        <div style={{ background: "#ffecec", padding: 10, borderRadius: 8 }}>
          {error}
        </div>
      )}

      <table border="1" width="100%" cellPadding="10" style={{ marginTop: 15 }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Full Name</th>
            <th>Email</th>
            <th>Message</th>
            <th>Date</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {contacts.map((c) => (
            <tr key={c.id}>
              <td>{c.id}</td>
              <td>{c.full_name}</td>
              <td>{c.email}</td>
              <td style={{ maxWidth: 420, whiteSpace: "pre-wrap" }}>{c.message}</td>
              <td>{c.created_at ? new Date(c.created_at).toLocaleString() : ""}</td>
              <td>
                <button onClick={() => handleDelete(c.id)}>Delete</button>
              </td>
            </tr>
          ))}

          {contacts.length === 0 && !error && (
            <tr>
              <td colSpan="6" style={{ textAlign: "center", padding: 20 }}>
                No messages yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default AdminContacts;
