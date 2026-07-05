import { create } from "zustand";
import apiClient from "../api/client";

const storedUser = localStorage.getItem("auth_user");

export const useAuthStore = create((set) => ({
  user: storedUser ? JSON.parse(storedUser) : null,
  token: localStorage.getItem("access_token"),
  isAuthenticated: !!localStorage.getItem("access_token"),

  setAuth: (user, token) => {
    localStorage.setItem("access_token", token);
    localStorage.setItem("auth_user", JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  clearAuth: async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // Local logout should still complete if the server session already expired.
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("auth_user");
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
