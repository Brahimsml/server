import { Navigate } from "react-router-dom";
import AdminLayout from "./admin/AdminLayout";

// Admin pages: signed-in admins get the admin layout (sidebar etc.), others go to login
export default function AdminRoute({ children }) {
  const token = localStorage.getItem("adminToken");
  return token ? <AdminLayout>{children}</AdminLayout> : <Navigate to="/admin/login" replace />;
}
