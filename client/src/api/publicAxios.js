import axios from "axios";

const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
  withCredentials: false,
});

// Key: Force remove Authorization to avoid accidental inclusion
publicApi.interceptors.request.use((config) => {
  if (config.headers?.Authorization) delete config.headers.Authorization;
  if (config.headers?.authorization) delete config.headers.authorization;
  return config;
});

export default publicApi;
