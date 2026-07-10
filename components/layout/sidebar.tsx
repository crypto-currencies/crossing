"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Settings,
  Pin,
  PinOff,
  Bell,
  ShieldCheck,
  LifeBuoy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth";
import { useNotificationsStore } from "@/store/notifications";
import { Avatar } from "@/components/ui/avatar";
import { Tooltip } from "@/components/ui/tooltip";
import type { NavItem } from "@/types";

// ─── Nav definitions ──────────────────────────────────────────────────────────

const PRIMARY_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
];

const SECONDARY_NAV: NavItem[] = [
  { label: "Notifications", href: "/notifications", icon: Bell     },
  { label: "Support",       href: "/support",       icon: LifeBuoy },
  { label: "Settings",      href: "/settings",      icon: Settings },
];

interface SidebarProps {
  className?:       string;
  onRequestOpen?:   () => void;
  onRequestClose?:  () => void;
}

export function Sidebar({
  className,
  onRequestOpen,
  onRequestClose,
}: SidebarProps) {
  const {
    sidebarOpen,
    sidebarHoverIntent,
    sidebarPinned,
    toggleSidebarPinned,
    setSidebarOpen,
    setSidebarHoverIntent,
  } = useUIStore();

  const { user }            = useAuthStore();
  const unreadNotifications = useNotificationsStore((s) => s.unreadCount);

  const pathname = usePathname();
  const expanded = sidebarPinned || sidebarHoverIntent;

  const primaryNav: NavItem[] = PRIMARY_NAV;

  const secondaryNav: NavItem[] = SECONDARY_NAV.map((item) => ({
    ...item,
    badge: item.href === "/notifications" ? (unreadNotifications || undefined) : undefined,
  }));

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 lg:hidden sidebar-overlay"
            style={{ zIndex: 39, background: "rgba(0,0,0,0.55)" }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed top-[var(--topbar-height)] bottom-0 left-0",
          "flex flex-col overflow-hidden",
          "sidebar-panel",
          expanded ? "lg:w-[var(--sidebar-width)]" : "lg:w-[var(--sidebar-collapsed)]",
          "w-[min(var(--sidebar-width),calc(100vw-32px))]",
          "lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          "transition-all duration-[200ms] ease-out",
          className
        )}
        style={{
          zIndex:      40,
          borderRight: "1px solid rgba(255,255,255,0.04)",
        }}
        aria-label="Sidebar navigation"
        data-expanded={expanded}
        onMouseEnter={onRequestOpen}
        onMouseLeave={onRequestClose}
        onFocus={() => setSidebarHoverIntent(true)}
      >
        {/* ── Primary nav ─────────────────────────────────────────────────── */}
        <nav
          className="flex-1 overflow-y-auto overflow-x-hidden px-[8px] pt-[16px] pb-[4px]"
          style={{ scrollbarWidth: "none" }}
          aria-label="Primary"
        >
          <div className="flex flex-col gap-[2px]">
            {primaryNav.map((item) => (
              <SidebarLink
                key={item.href}
                item={item}
                collapsed={!expanded}
                pathname={pathname}
              />
            ))}
          </div>
        </nav>

        {/* ── Divider ──────────────────────────────────────────────────────── */}
        <div className="px-[16px] py-[8px]">
          <div className="h-px bg-[rgba(255,255,255,0.05)]" />
        </div>

        {/* ── Secondary nav ───────────────────────────────────────────────── */}
        <nav className="px-[8px] pb-[4px]" aria-label="Account">
          <div className="flex flex-col gap-[2px]">
            {secondaryNav.map((item) => (
              <SidebarLink
                key={item.href}
                item={item}
                collapsed={!expanded}
                pathname={pathname}
              />
            ))}
          </div>
        </nav>

        {/* ── Admin link — only for ADMIN / OWNER ─────────────────────────── */}
        {(user?.role === "ADMIN" || user?.role === "OWNER") && (
          <>
            <div className="px-[16px] py-[8px]">
              <div className="h-px bg-[rgba(109,40,217,0.12)]" />
            </div>
            <nav className="px-[8px] pb-[4px]" aria-label="Admin">
              <SidebarLink
                item={{
                  label: "Admin",
                  href:  "/control/admin",
                  icon:  ShieldCheck,
                  exact: true,
                }}
                collapsed={!expanded}
                pathname={pathname}
              />
            </nav>
          </>
        )}

        {/* ── Profile strip ───────────────────────────────────────────────── */}
        {user && (
          <>
            <div className="px-[16px] py-[8px]">
              <div className="h-px bg-[rgba(255,255,255,0.04)]" />
            </div>
            <div className="px-[8px] pb-[8px]">
              {expanded ? (
                <div
                  className={cn(
                    "flex items-center gap-[10px] rounded-[10px]",
                    "px-[10px] py-[9px]",
                    "text-[var(--text-soft)]"
                  )}
                >
                  <Avatar src={user.image} alt={user.name ?? "User"} size="sm" status="online" className="flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium leading-tight text-[var(--text-soft)]">
                      {user.name ?? "User"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center py-[8px]">
                  <Tooltip content={user.name ?? "User"} side="right">
                    <Avatar src={user.image} alt={user.name ?? "User"} size="sm" status="online" />
                  </Tooltip>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Pin toggle (desktop only) ────────────────────────────────────── */}
        <div className="hidden px-[8px] pb-[10px] lg:block">
          {expanded ? (
            <div className="flex items-center justify-end px-[10px]">
              <button
                onClick={toggleSidebarPinned}
                className={cn(
                  "flex size-[24px] items-center justify-center rounded-[7px]",
                  "transition-all duration-[120ms]",
                  "hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--text-soft)]",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
                  sidebarPinned ? "text-[var(--text-soft)]" : "text-[rgba(255,255,255,0.18)]"
                )}
                aria-label={sidebarPinned ? "Unpin sidebar" : "Pin sidebar open"}
                aria-pressed={sidebarPinned}
              >
                {sidebarPinned ? <PinOff className="size-[11px]" /> : <Pin className="size-[11px]" />}
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <Tooltip content={sidebarPinned ? "Unpin sidebar" : "Pin sidebar open"} side="right">
                <button
                  onClick={toggleSidebarPinned}
                  className={cn(
                    "flex size-[24px] items-center justify-center rounded-[7px]",
                    "transition-all duration-[120ms]",
                    "hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--text-soft)]",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
                    sidebarPinned ? "text-[var(--text-soft)]" : "text-[rgba(255,255,255,0.18)]"
                  )}
                  aria-label={sidebarPinned ? "Unpin sidebar" : "Pin sidebar open"}
                  aria-pressed={sidebarPinned}
                >
                  {sidebarPinned ? <PinOff className="size-[11px]" /> : <Pin className="size-[11px]" />}
                </button>
              </Tooltip>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ─── SidebarLink ──────────────────────────────────────────────────────────────

interface SidebarLinkProps {
  item:      NavItem;
  collapsed: boolean;
  pathname:  string;
}

function SidebarLink({ item, collapsed, pathname }: SidebarLinkProps) {
  const active = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + "/");

  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      className={cn(
        "relative flex items-center rounded-[10px]",
        "text-[12.5px] font-medium leading-none",
        "transition-colors duration-[120ms]",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
        collapsed
          ? "size-[38px] justify-center"
          : "h-[36px] gap-[10px] px-[12px]",
        active
          ? "text-[var(--text)] bg-[rgba(255,255,255,0.05)]"
          : "text-[rgba(255,255,255,0.32)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[rgba(255,255,255,0.55)]"
      )}
      aria-current={active ? "page" : undefined}
    >
      {/* Active accent — left dot, no glow */}
      {active && !collapsed && (
        <span
          className="absolute left-0 rounded-full"
          style={{
            top:        10,
            bottom:     10,
            width:      2,
            background: "rgba(124,92,219,0.70)",
          }}
          aria-hidden
        />
      )}

      {Icon && (
        <Icon
          className={cn(
            "flex-shrink-0 transition-colors",
            collapsed ? "size-[16px]" : "size-[15px]",
            active ? "text-[rgba(255,255,255,0.70)]" : "text-[rgba(255,255,255,0.28)]"
          )}
          aria-hidden
        />
      )}

      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge != null && (
            <span className="flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[var(--accent)] px-[4px] text-[9px] font-bold text-white">
              {item.badge}
            </span>
          )}
        </>
      )}

      {collapsed && item.badge != null && (
        <span className="absolute right-[7px] top-[7px] size-[4px] rounded-full bg-[var(--accent)]" />
      )}
    </Link>
  );

  return collapsed
    ? <Tooltip content={item.label} side="right">{link}</Tooltip>
    : link;
}
