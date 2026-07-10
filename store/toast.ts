import { create } from "zustand";
import type { Toast, ToastVariant } from "@/types";

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

interface ToastState {
  toasts: Toast[];
}

interface ToastActions {
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
  toast: (title: string, options?: { body?: string; variant?: ToastVariant; duration?: number }) => string;
  success: (title: string, body?: string) => string;
  warning: (title: string, body?: string) => string;
  error: (title: string, body?: string) => string;
}

type ToastStore = ToastState & ToastActions;

export const useToastStore = create<ToastStore>()((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    const id = randomId();
    const duration = toast.duration ?? 4000;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    if (duration > 0) {
      setTimeout(() => get().removeToast(id), duration);
    }
    return id;
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  clearAll: () => set({ toasts: [] }),

  toast: (title, options) => {
    return get().addToast({ title, variant: "default", ...options });
  },

  success: (title, body) => {
    return get().addToast({ title, body, variant: "success" });
  },

  warning: (title, body) => {
    return get().addToast({ title, body, variant: "warning" });
  },

  error: (title, body) => {
    return get().addToast({ title, body, variant: "danger" });
  },
}));
