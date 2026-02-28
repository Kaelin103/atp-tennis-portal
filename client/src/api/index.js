
import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://localhost:5000/api",
  timeout: 10000,
});

export const predictMatch = ({ playerAId, playerBId }) => {
  return API.post("/predict", { playerAId, playerBId });
};

export const searchPlayers = (q, limit = 10) => {
  return API.get(`/players/search?q=${encodeURIComponent(q)}&limit=${limit}`);
};

export default API;
