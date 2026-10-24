import { Navigate } from "react-router-dom";
import AdminLayout from "./admin/AdminLayout";

// Admin pages: signed-in admins get the admin layout (sidebar etc.), others go to login.
// bare: no sidebar (e.g. the printable invoice)
export default function AdminRoute({ children, bare = false }) {
  const token = localStorage.getItem("adminToken");
  if (!token) return <Navigate to="/admin/login" replace />;
  return bare ? children : <AdminLayout>{children}</AdminLayout>;
}
