import { create } from "zustand";
import apiClient from "../api/client";

function cachedName() {
  try { return localStorage.getItem("portal-name") || "Portal"; } catch { return "Portal"; }
}
function rememberName(name) {
  try { localStorage.setItem("portal-name", name); } catch { /* Branding still works when browser storage is disabled. */ }
}

export const useBrandingStore = create((set) => ({
  portalName: cachedName(),
  load: async () => {
    try {
      const { data } = await apiClient.get("/branding");
      set({ portalName: data.portal_name });
      rememberName(data.portal_name);
      document.title = data.portal_name;
    } catch { /* Keep the last known name if the server is temporarily unavailable. */ }
  },
  save: async (portalName) => {
    const { data } = await apiClient.put("/branding", { portal_name: portalName });
    set({ portalName: data.portal_name });
    rememberName(data.portal_name);
    document.title = data.portal_name;
  },
}));
