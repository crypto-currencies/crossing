"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  X,
  Settings,
  BadgeCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, relativeTime } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { useNotificationsStore } from "@/store/notifications";
import { markNotifRead, markAllNotifsRead, dismissNotif } from "@/lib/services/notify";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import type { Notification } from "@/types";

// ─── Config ──────────────────────────────────────────────────────────────────

const TYPE_META: Record<
  Notification["type"],
  { label: string; icon: React.ElementType; color: string }
> = {
  verification: { label: "Verified", icon: BadgeCheck, color: "text-[var(--success)]" },
  system:       { label: "System",   icon: Settings,   color: "text-[var(--text-soft)]" },
};

type FilterKey = Notification["type"] | "all" | "unread";

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: "all",          label: "All" },
  { key: "unread",       label: "Unread" },
  { key: "verification", label: "Verifications" },
  { key: "system",       label: "System" },
];

// ─── Single notification row ──────────────────────────────────────────────────

function NotifRow({ notif }: { notif: Notification }) {
  const meta = TYPE_META[notif.type] ?? TYPE_META.system;
  const Icon = meta.icon;

  const inner = (
    <motion.div
      layout
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      className={cn(
        "group flex items-start gap-[14px] px-[20px] py-[14px] border-b border-[var(--border)] last:border-0 transition-colors",
        notif.read
          ? "hover:bg-[var(--panel-2)]"
          : "bg-[var(--panel)] hover:bg-[var(--panel-2)]"
      )}
      onClick={() => { if (!notif.read) markNotifRead(notif.id); }}
    >
      {/* Icon */}
      <div className="relative flex-shrink-0">
        <div className={cn(
          "flex size-10 items-center justify-center rounded-full",
          notif.read ? "bg-[var(--panel-2)]" : "bg-[rgba(255,255,255,0.04)]"
        )}>
          {notif.actorAvatar !== undefined ? (
            <Avatar src={notif.actorAvatar ?? null} alt="" size="sm" />
          ) : (
            <Icon className={cn("size-5", notif.read ? "text-[var(--text-soft)]" : meta.color)} />
          )}
        </div>
        {!notif.read && (
          <span className="absolute -top-[1px] -right-[1px] size-[8px] rounded-full bg-white border-2 border-[var(--panel)]" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-[8px]">
          <p className={cn("t-label", notif.read ? "text-[var(--text-soft)]" : "text-[var(--text)]")}>
            {notif.title}
          </p>
          <span className="t-caption flex-shrink-0 text-[var(--text-tertiary)] mt-[1px]">
            {relativeTime(notif.createdAt)}
          </span>
        </div>
        <p className="t-body-sm text-[var(--text-soft)] mt-[3px] line-clamp-2">{notif.body}</p>
        {!notif.read && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); markNotifRead(notif.id); }}
            className="mt-[4px] t-caption text-[var(--muted)] hover:text-[var(--text-soft)] transition-colors"
          >
            Mark read
          </button>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); dismissNotif(notif.id); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-[var(--text-soft)] hover:text-[var(--danger)] p-[4px]"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>
    </motion.div>
  );

  if (notif.href) {
    return <Link href={notif.href} className="block cursor-pointer">{inner}</Link>;
  }
  return <div className="cursor-pointer">{inner}</div>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function NotificationsClient() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { notifications, unreadCount } = useNotificationsStore();
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  useEffect(() => {
    if (!isAuthenticated) router.replace("/login");
  }, [isAuthenticated, router]);

  const filtered = useMemo(() => {
    if (activeFilter === "all") return notifications;
    if (activeFilter === "unread") return notifications.filter((n) => !n.read);
    return notifications.filter((n) => n.type === activeFilter);
  }, [notifications, activeFilter]);

  const visibleFilters = useMemo(() => {
    const hasVerifications = notifications.some((n) => n.type === "verification");
    return FILTER_OPTIONS.filter(({ key }) => {
      if (key === "verification") return hasVerifications;
      return true;
    });
  }, [notifications]);

  if (!isAuthenticated) return null;

  function clearAll() {
    notifications.forEach((n) => dismissNotif(n.id));
  }

  return (
    <div className="section-stack">
      {/* Compact inline header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-[12px]">
        <div className="flex items-center gap-[20px]">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">notifications</p>
          <div className="flex items-center gap-[16px]">
            <span className="t-caption"><span className="font-semibold text-[var(--text)]">{notifications.length}</span> total</span>
            {unreadCount > 0 && (
              <span className="t-caption"><span className="font-semibold text-[var(--text)]">{unreadCount}</span> unread</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-[6px]">
          {unreadCount > 0 && (
            <Button variant="ghost" size="xs" onClick={() => markAllNotifsRead()}>Mark all read</Button>
          )}
          {notifications.length > 0 && (
            <Button variant="ghost" size="xs" onClick={clearAll}>Clear all</Button>
          )}
        </div>
      </div>

      {/* Type filter tabs */}
      <div className="flex items-center border-b border-[var(--border)] overflow-x-auto">
        {visibleFilters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveFilter(key)}
            className={cn(
              "px-[12px] py-[8px] t-label border-b-2 -mb-px transition-colors whitespace-nowrap flex-shrink-0",
              activeFilter === key
                ? "border-[var(--text)] text-[var(--text)]"
                : "border-transparent text-[var(--text-soft)] hover:text-[var(--text)]"
            )}
          >
            {label}
            {key === "unread" && unreadCount > 0 && (
              <span className="ml-[4px] font-mono text-[9px] text-[var(--muted)]">({unreadCount})</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] overflow-hidden">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-[12px] px-[20px] py-[36px] text-center"
            >
              <div
                className="flex size-[44px] items-center justify-center rounded-full"
                style={{ background: "var(--panel-2)", border: "1px solid var(--border)" }}
              >
                <Bell className="size-[18px] text-[var(--muted)]" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-[var(--text-soft)]">
                  {activeFilter === "unread" ? "All caught up" : "No notifications yet"}
                </p>
                <p className="mt-[3px] t-caption text-[var(--muted)]">
                  {activeFilter === "unread"
                    ? "You're up to date — check back later."
                    : "Account and system notifications will appear here."}
                </p>
              </div>
            </motion.div>
          ) : (
            filtered.map((n) => <NotifRow key={n.id} notif={n} />)
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
