import { useNavigate } from "react-router-dom";

export default function AdminLogout() {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("admin");
    navigate("/admin/login");
  };

  return (
    <button
      onClick={logout}
      style={{
        padding: "8px 14px",
        background: "#c62828",
        color: "#fff",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
        marginLeft: 10,
      }}
    >
      Logout
    </button>
  );
}
