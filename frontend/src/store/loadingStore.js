import { create } from "zustand";

export const useLoadingStore = create((set) => ({
  activeRequests: 0,
  beginRequest: () =>
    set((state) => ({
      activeRequests: state.activeRequests + 1,
    })),
  endRequest: () =>
    set((state) => ({
      activeRequests: Math.max(0, state.activeRequests - 1),
    })),
}));
