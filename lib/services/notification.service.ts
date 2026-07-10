import type { Notification } from "@/types";
import { apiFetch, apiPatch } from "./utils";

interface NotifListResponse {
  items: Notification[];
  unreadCount: number;
}

export const notificationService = {
  async list(): Promise<{ items: Notification[]; unreadCount: number }> {
    const result = await apiFetch<NotifListResponse>("/api/notifications");
    if (result) return result;
    return { items: [], unreadCount: 0 };
  },

  async getUnreadCount(): Promise<number> {
    const result = await apiFetch<NotifListResponse>("/api/notifications?unread=true&limit=1");
    if (result) return result.unreadCount;
    return 0;
  },

  async markRead(notificationId: string): Promise<void> {
    // Soft-fail: an unreachable API just leaves the notification unread.
    await apiPatch<{ ok: boolean }>("/api/notifications", { ids: [notificationId] });
  },

  async markAllRead(): Promise<void> {
    await apiPatch<{ ok: boolean }>("/api/notifications", { all: true });
  },

  async dismiss(notificationId: string): Promise<void> {
    await notificationService.markRead(notificationId);
  },
};
