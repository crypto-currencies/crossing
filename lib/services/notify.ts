/**
 * Client-side helpers that persist notifications AND update the local store.
 * Import only in client components / service layer — never in server code.
 */
import type { Notification } from "@/types";
import { notificationService } from "./notification.service";

/** Marks one notification as read locally AND persists to server. */
export async function markNotifRead(id: string): Promise<void> {
  const { useNotificationsStore } = await import("@/store/notifications");
  useNotificationsStore.getState().markRead(id);
  notificationService.markRead(id).catch(() => {});
}

/** Marks all notifications as read locally AND persists to server. */
export async function markAllNotifsRead(): Promise<void> {
  const { useNotificationsStore } = await import("@/store/notifications");
  useNotificationsStore.getState().markAllRead();
  notificationService.markAllRead().catch(() => {});
}

/** Dismisses a notification locally (no server persist needed — it's a UX action). */
export function dismissNotif(id: string): void {
  import("@/store/notifications").then(({ useNotificationsStore }) => {
    useNotificationsStore.getState().dismiss(id);
  });
  // Optionally persist dismiss as mark-read so it doesn't re-appear after refresh
  notificationService.markRead(id).catch(() => {});
}

/** Pushes a new notification to the local store (for real-time feel when DB is available). */
export function addLocalNotif(n: Omit<Notification, "id" | "createdAt">): void {
  const notif: Notification = {
    ...n,
    id: `notif-local-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  import("@/store/notifications").then(({ useNotificationsStore }) => {
    useNotificationsStore.getState().addNotification(notif);
  });
}
