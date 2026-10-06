import { create } from "zustand";

let sequence = 0;
export const useToastStore = create((set) => ({
  toasts: [],
  add: (message, severity = "info", pending = false) => {
    const id = ++sequence;
    set((state) => ({ toasts: [...state.toasts, { id, message, severity, pending }].slice(-5) }));
    return id;
  },
  finish: (id, message, severity) => set((state) => ({
    toasts: state.toasts.map((toast) => toast.id === id && toast.pending
      ? { ...toast, message, severity, pending: false } : toast),
  })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));
