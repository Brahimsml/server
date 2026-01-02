import axios from "axios";

const api = axios.create({
  baseURL: "https://server-2plo.onrender.com",
});

// Attach token automatically to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("adminToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto logout if token invalid
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 || err?.response?.status === 403) {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("admin");
      if (window.location.pathname !== "/admin/login") {
        window.location.href = "/admin/login";
      }
    }
    return Promise.reject(err);
  }
);

export default api;
