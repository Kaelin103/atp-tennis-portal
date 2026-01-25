// client/src/api/axios.js
import axios from "axios";
import { message } from "antd";

const baseURL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV
    ? "http://localhost:5000/api"
    : "https://your-deployed-domain.com/api");

const api = axios.create({
  baseURL,
  timeout: 30000,
  withCredentials: true, 
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status } = error.response;

      if (status === 401) {
        console.warn("⚠️ Unauthorized, redirecting to login...");
        message.warning("Session expired or unauthorized. Please log in.");
        window.location.href = "/login";
      } else if (status === 403) {
        console.error("❌ Access forbidden: Admin access required.");
        message.error("Access denied: Admin privileges required.");
      } else if (status === 404) {
        console.error("❌ API route not found:", error.config.url);
        message.warning("API route not found.");
      } else if (status >= 500) {
        console.error("💥 Server error:", error.response.data?.message);
        message.error(error.response.data?.message || "Server error.");
      }
    } else if (error.code === "ECONNABORTED") {
      console.error("⏱️ Request timeout: backend took too long to respond.");
      message.error("Request timeout. Please try again.");
    } else {
      console.error("🚫 Network error or backend unavailable.");
      message.error("Network error or backend unavailable.");
    }

    return Promise.reject(error);
  }
);

export default api;
