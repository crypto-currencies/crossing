"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Bell,
  X,
  Settings,
  CheckCheck,
  BadgeCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotificationsStore } from "@/store/notifications";
import { markNotifRead, markAllNotifsRead, dismissNotif } from "@/lib/services/notify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Notification } from "@/types";

// ─── Config ──────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<Notification["type"], React.ElementType> = {
  verification: BadgeCheck,
  system:       Settings,
};

type PanelTab = "all" | "unread";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffM = Math.floor(diffMs / 60000);
  if (diffM < 1) return "just now";
  if (diffM < 60) return `${diffM}m ago`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

// ─── Item ─────────────────────────────────────────────────────────────────────

function NotifItem({ notif, onDismiss }: { notif: Notification; onDismiss: (id: string) => void }) {
  const Icon = TYPE_ICONS[notif.type] ?? Bell;

  const content = (
    <div
      className={cn(
        "flex items-start gap-[10px] px-[14px] py-[11px] transition-colors group cursor-pointer",
        notif.read ? "hover:bg-[var(--panel-2)]" : "bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.05)]"
      )}
      onClick={() => { if (!notif.read) markNotifRead(notif.id); }}
    >
      {/* Unread dot */}
      <div className="relative flex-shrink-0 mt-[1px]">
        <div className={cn(
          "flex size-8 items-center justify-center rounded-full",
          notif.read ? "bg-[var(--panel-2)]" : "bg-[rgba(255,255,255,0.06)]"
        )}>
          <Icon className={cn("size-4", notif.read ? "text-[var(--text-soft)]" : "text-[var(--text)]")} />
        </div>
        {!notif.read && (
          <span className="absolute -top-[2px] -right-[2px] size-[6px] rounded-full bg-[var(--purple)]" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn("t-label", notif.read ? "text-[var(--text-soft)]" : "text-[var(--text)]")}>
          {notif.title}
        </p>
        <p className="t-caption mt-[2px] line-clamp-2 text-[var(--text-soft)]">{notif.body}</p>
        <p className="t-caption mt-[3px] text-[var(--text-tertiary)]">{formatTime(notif.createdAt)}</p>
      </div>

      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(notif.id); }}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-soft)] hover:text-[var(--text)] p-[2px]"
        aria-label="Dismiss notification"
        title="Dismiss"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );

  if (notif.href) {
    return <Link href={notif.href} className="block">{content}</Link>;
  }
  return content;
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function NotificationPanel() {
  const { notifications, unreadCount, panelOpen, closePanel } =
    useNotificationsStore();
  const [tab, setTab] = useState<PanelTab>("all");

  const visible = tab === "unread"
    ? notifications.filter((n) => !n.read)
    : notifications;

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            key="notif-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0"
            style={{ zIndex: 55 }}
            onClick={closePanel}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            key="notif-panel"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[calc(var(--nav-height,56px)+8px)] right-[12px] w-[380px] max-w-[calc(100vw-24px)] rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-xl)] overflow-hidden flex flex-col"
            style={{ zIndex: 56, maxHeight: "min(520px, calc(100vh - 80px))" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-[8px] px-[14px] py-[12px] border-b border-[var(--border)] flex-shrink-0">
              <div className="flex items-center gap-[8px]">
                <p className="t-label text-[var(--text)]">Notifications</p>
                {unreadCount > 0 && (
                  <Badge variant="accent" size="xs">{unreadCount}</Badge>
                )}
              </div>
              <div className="flex items-center gap-[4px]">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="xs" onClick={() => markAllNotifsRead()} title="Mark all read">
                    <CheckCheck className="size-3.5 mr-[4px]" />
                    All read
                  </Button>
                )}
                <Button variant="ghost" size="icon-sm" onClick={closePanel} aria-label="Close" title="Close">
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-[var(--border)] flex-shrink-0">
              {(["all", "unread"] as PanelTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "flex-1 py-[8px] t-label capitalize transition-colors border-b-2 -mb-px",
                    tab === t
                      ? "border-[var(--text)] text-[var(--text)]"
                      : "border-transparent text-[var(--text-soft)] hover:text-[var(--text)]"
                  )}
                >
                  {t}
                  {t === "unread" && unreadCount > 0 && (
                    <span className="ml-[5px] text-[10px] text-[var(--text-soft)]">({unreadCount})</span>
                  )}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
              {visible.length === 0 ? (
                <div className="flex flex-col items-center py-[32px] gap-[8px] text-center">
                  <Bell className="size-6 text-[var(--text-soft)]" />
                  <p className="t-label text-[var(--text)]">
                    {tab === "unread" ? "All caught up" : "No notifications"}
                  </p>
                  <p className="t-caption">
                    {tab === "unread" ? "Nothing unread." : "Notifications will appear here."}
                  </p>
                </div>
              ) : (
                visible.map((n) => (
                  <NotifItem key={n.id} notif={n} onDismiss={dismissNotif} />
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 border-t border-[var(--border)] px-[14px] py-[10px]">
              <Link
                href="/notifications"
                onClick={closePanel}
                className="block text-center t-label text-[var(--text-soft)] hover:text-[var(--text)] transition-colors"
              >
                View all notifications
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
