// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import axios from "axios";
import { message } from "antd";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [loading, setLoading] = useState(true);
  const lastLogoutToastRef = useRef(0);

  const api = axios.create({
    baseURL: "http://localhost:5000/api",
  });

  api.interceptors.request.use((config) => {
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  const register = async (name, email, password) => {
    try {
      const res = await api.post("/auth/register", { name, email, password });
      setToken(res.data.token);
      localStorage.setItem("token", res.data.token);
      setUser(res.data.user);
      message.success("Registration successful!");
      return res.data;
    } catch (err) {
      console.error("❌ Registration failed:", err);
      message.error(err.response?.data?.message || "Registration failed.");
      throw err;
    }
  };

  const login = async (email, password) => {
    try {
      const res = await api.post("/auth/login", { email, password });
      const { token, user } = res.data;
      setToken(token);
      setUser(user);
      localStorage.setItem("token", token);

      setTimeout(() => {
        message.success("Login successful!");
      }, 0);
      return res.data;
    } catch (err) {
      console.error("❌ Login failed:", err);
      message.error(err.response?.data?.message || "Login failed.");
      throw err;
    }
  };

  const fetchProfile = async () => {
    if (!token) return;
    try {
      // Prefer /auth/me which is guarded by middleware and returns the current user
      const res = await api.get("/auth/me");
      setUser(res.data.user);
    } catch (err) {
      const status = err?.response?.status;
      // Only log unexpected errors (non-401)
      if (status !== 401) {
        console.error("❌ Profile fetch failed:", err);
      }
      
      if (status === 401) {
        message.warning("Session expired. Please log in again.");
        // Avoid duplicate notifications: silently log out when session expires
        logout(true);
      } else {
        // Do not force logout on transient errors (network, 5xx). Keep current user state.
        message.warning("Profile fetch failed. Retaining current session.");
      }
    } finally {
      setLoading(false);
    }
  };

const updateProfile = async (data) => {
  try {
    const res = await api.put("/auth/profile/update", data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.data?.user) {
      setUser(res.data.user);
    }
    return res.data;
  } catch (err) {
    console.error("❌ Update failed:", err);
    throw err;
  }
};


  const logout = (silent = false) => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    if (!silent) {
      const now = Date.now();
      if (now - (lastLogoutToastRef.current || 0) > 1200) {
        message.info("You have logged out.");
        lastLogoutToastRef.current = now;
      }
    }
  };

  useEffect(() => {
    if (token) fetchProfile();
    else setLoading(false);
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        register,
        login,
        logout,
        updateProfile,
        fetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
