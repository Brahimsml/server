import axios from "axios";

// Backend URL comes from frontend/.env (REACT_APP_API_URL).
// Testing from a phone on the same Wi-Fi (http://192.168.x.x:3000)? Then "localhost"
// would mean the phone itself, so use the computer the page came from instead.
// This keeps working when the router gives the computer a new address.
const LOCAL_HOSTS = ["localhost", "127.0.0.1"];
const sameComputer = (url) => {
  try {
    const api = new URL(url);
    const here = window.location.hostname;
    if (LOCAL_HOSTS.includes(api.hostname) && !LOCAL_HOSTS.includes(here)) {
      api.hostname = here;
      return api.toString().replace(/\/$/, "");
    }
  } catch {}
  return url;
};

export const API_URL = sameComputer(process.env.REACT_APP_API_URL);

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
