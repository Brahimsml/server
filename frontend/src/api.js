import axios from "axios";

// Backend URL comes from frontend/.env (REACT_APP_API_URL)
export const API_URL = process.env.REACT_APP_API_URL;

const api = axios.create({
  baseURL: API_URL,
});

// Attach the admin token, unless the page already sent its own (e.g. a customer token)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("adminToken");
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
    config.usedAdminToken = true;
  }
  return config;
});

// Auto logout if the admin token is invalid (customer requests handle their own errors)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (err?.config?.usedAdminToken && (status === 401 || status === 403)) {
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
