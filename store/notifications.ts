import { create } from "zustand";
import type { Notification } from "@/types";

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  panelOpen: boolean;
}

interface NotificationsActions {
  load: (notifications: Notification[]) => void;
  setLoading: (loading: boolean) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  addNotification: (n: Notification) => void;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  /** Clear all notifications — call on logout / account switch. */
  clear: () => void;
}

type NotificationsStore = NotificationsState & NotificationsActions;

export const useNotificationsStore = create<NotificationsStore>()((set) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  panelOpen: false,

  load: (notifications) =>
    set({ notifications, unreadCount: notifications.filter((n) => !n.read).length }),

  setLoading: (isLoading) => set({ isLoading }),

  markRead: (id) =>
    set((s) => {
      const notifications = s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      return { notifications, unreadCount: notifications.filter((n) => !n.read).length };
    }),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  dismiss: (id) =>
    set((s) => {
      const notifications = s.notifications.filter((n) => n.id !== id);
      return { notifications, unreadCount: notifications.filter((n) => !n.read).length };
    }),

  addNotification: (n) =>
    set((s) => ({
      notifications: [n, ...s.notifications],
      unreadCount: s.unreadCount + (n.read ? 0 : 1),
    })),

  openPanel: () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),

  clear: () => set({ notifications: [], unreadCount: 0, isLoading: false, panelOpen: false }),
}));
