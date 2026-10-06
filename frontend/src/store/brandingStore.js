import { create } from "zustand";
import apiClient from "../api/client";

function validName(value) {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name && name !== "undefined" && name !== "null" ? name : null;
}

function cachedName() {
  try { return validName(localStorage.getItem("portal-name")) || "Portal"; } catch { return "Portal"; }
}
function rememberName(name) {
  try { localStorage.setItem("portal-name", name); } catch { /* Branding still works when browser storage is disabled. */ }
}

export const useBrandingStore = create((set) => ({
  portalName: cachedName(),
  load: async () => {
    try {
      const { data } = await apiClient.get("/branding");
      const name = validName(data?.portal_name);
      if (!name) return;
      set({ portalName: name });
      rememberName(name);
      document.title = name;
    } catch { /* Keep the last known name if the server is temporarily unavailable. */ }
  },
  save: async (portalName) => {
    const requestedName = validName(portalName);
    if (!requestedName) throw new Error("Enter a valid portal name.");
    const { data } = await apiClient.put("/branding", { portal_name: requestedName });
    const name = validName(data?.portal_name);
    if (!name) throw new Error("The server returned an invalid portal name. Please try again.");
    set({ portalName: name });
    rememberName(name);
    document.title = name;
  },
}));
