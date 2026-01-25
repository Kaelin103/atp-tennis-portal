import api from "./axios";

export const AuthAPI = {
  async register(payload) {
    const res = await api.post("/auth/register", payload);
    return res.data;
  },
  async login(payload) {
    const res = await api.post("/auth/login", payload);
    return res.data;
  },
  async me() {
    const res = await api.get("/auth/me");
    return res.data;
  },
};
