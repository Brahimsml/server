import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "../Styles/admin.css"; // make sure this file contains the CSS you sent

function AdminContacts() {
  const [contacts, setContacts] = useState([]);
  const [error, setError] = useState("");

  const fetchContacts = async () => {
    try {
      const res = await api.get("https://server-2plo.onrender.com/contacts");
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
      await api.delete(`/contacts/${id}`);
      fetchContacts();
    } catch (err) {
      console.error(err);
      alert("Delete failed");
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-container">
        {/* Header */}
        <div className="admin-header">
          <div className="admin-title">
            <h1>Contacts</h1>
            <p>Messages sent by users</p>
          </div>

          <div className="admin-actions">
            <Link to="/products/admin" className="btn btn-ghost btn-sm">
              Products
            </Link>
            <Link to="/places/admin" className="btn btn-ghost btn-sm">
              Places
            </Link>
            <Link to="/orders/admin" className="btn btn-ghost btn-sm">
              Orders
            </Link>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-body" style={{ color: "#ef4444" }}>
              {error}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="panel">
          <div className="panel-header">
            <h2>Contact Messages</h2>
          </div>

          <div className="table-wrap">
            <table className="table">
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
                    <td style={{ maxWidth: 420, whiteSpace: "pre-wrap" }}>
                      {c.message}
                    </td>
                    <td>
                      {c.created_at
                        ? new Date(c.created_at).toLocaleString()
                        : ""}
                    </td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(c.id)}
                      >
                        Delete
                      </button>
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
        </div>
      </div>
    </div>
  );
}

export default AdminContacts;
