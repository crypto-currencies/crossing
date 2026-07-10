"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Search, Bell, Menu, X, ChevronDown, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { useUIStore } from "@/store/ui";
import { useNotificationsStore } from "@/store/notifications";
import { useProductActions } from "@/components/product/product-modals";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { LogoMark } from "@/components/ui/logo";

interface NavProps {
  showSidebarToggle?: boolean;
}

export function Nav({ showSidebarToggle = false }: NavProps) {
  const { user, isAuthenticated } = useAuthStore();
  const { toggleSidebar, sidebarOpen, openSearch } = useUIStore();
  const { openSignOutConfirm } = useProductActions();
  const { unreadCount, togglePanel } = useNotificationsStore();

  // ── Scroll state ──────────────────────────────────────────────────────────────
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // ── Global keyboard shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag      = (e.target as HTMLElement).tagName;
      const editable = (e.target as HTMLElement).isContentEditable;
      const inInput  = tag === "INPUT" || tag === "TEXTAREA" || editable;

      if (
        (e.key === "/" && !inInput && !e.metaKey && !e.ctrlKey && !e.altKey) ||
        ((e.metaKey || e.ctrlKey) && e.key === "k")
      ) {
        e.preventDefault();
        openSearch();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openSearch]);

  return (
    /*
     * Outer shell — transparent, full-width, pointer-events disabled so page
     * content scrolling behind the nav isn't blocked.  The inner capsule re-
     * enables pointer events on its own surface.
     */
    <header
      className="fixed inset-x-0 top-0 flex items-start justify-center px-[var(--page-gutter)]"
      style={{
        height:        "var(--topbar-height)",
        zIndex:        50,
        paddingTop:    14,
        pointerEvents: "none",
      }}
      aria-label="Site header"
    >
      {/* ── Floating capsule ────────────────────────────────────────────────── */}
      <div
        className="topbar-capsule"
        data-scrolled={scrolled ? "true" : "false"}
      >
        {/* Brand */}
        <Link
          href="/"
          className="brand group flex-shrink-0"
          aria-label="Crossing.dev home"
        >
          <LogoMark size={26} />
          <span
            className="hidden font-bold transition-colors sm:block"
            style={{ fontSize: 14, letterSpacing: "-0.01em" }}
          >
            <span className="text-[var(--text)]">crossing</span>
            <span className="text-[var(--muted)] group-hover:text-[var(--text-soft)] transition-colors">.dev</span>
          </span>
        </Link>

        {/* Spacer — pushes actions to right */}
        <div className="flex-1" />

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-[10px]">

          {/* Search trigger — large screens */}
          <button
            type="button"
            onClick={openSearch}
            className={cn(
              "button hidden h-[36px] items-center gap-[8px] rounded-[var(--radius-md)]",
              "border border-[var(--border)] bg-[rgba(255,255,255,0.04)]",
              "px-[12px] text-[var(--muted)]",
              "hover:border-[var(--border-strong)] hover:bg-[rgba(255,255,255,0.07)] hover:text-[var(--text-soft)]",
              "transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
              isAuthenticated ? "xl:flex w-[200px]" : "lg:flex w-[220px]"
            )}
            aria-label="Search"
          >
            <Search className="size-3.5 flex-shrink-0" />
            <span className="flex-1 text-left" style={{ fontSize: 12 }}>Search</span>
            <kbd className="kbd">/</kbd>
          </button>

          {/* Search icon — small screens */}
          <Button
            variant="ghost"
            size="icon"
            className={cn("hidden", !isAuthenticated && "sm:flex lg:hidden")}
            onClick={openSearch}
            aria-label="Search"
          >
            <Search className="size-4" />
          </Button>

          {isAuthenticated ? (
            <>
              {/* Admin button — ADMIN / OWNER only */}
              {(user?.role === "OWNER" || user?.role === "ADMIN") && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/control/admin" className="flex items-center gap-[6px]" style={{ fontSize: 12 }}>
                    <ShieldCheck className="size-[13px]" />
                    <span className="hidden sm:inline">Admin</span>
                  </Link>
                </Button>
              )}

              {/* Notifications */}
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={togglePanel}
                  aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
                >
                  <Bell className="size-4" />
                </Button>
                {unreadCount > 0 && (
                  <span className="pointer-events-none absolute -right-[2px] -top-[2px] flex size-[15px] items-center justify-center rounded-full bg-[var(--accent)]">
                    <span className="text-[8px] font-bold leading-none text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  </span>
                )}
              </div>

              {/* User menu */}
              <UserMenu user={user} onSignOut={openSignOutConfirm} />
            </>
          ) : (
            <div className="hidden items-center gap-[8px] sm:flex">
              <Button variant="ghost" size="sm" className="text-[13px]" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button variant="primary" size="sm" className="text-[13px]" asChild>
                <Link href="/register">Sign up</Link>
              </Button>
            </div>
          )}

          {/* Mobile sidebar toggle */}
          {showSidebarToggle && (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={toggleSidebar}
              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
            >
              {sidebarOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── User dropdown ─────────────────────────────────────────────────────────────

function UserMenu({
  user,
  onSignOut,
}: {
  user:       import("@/types").User | null;
  onSignOut:  () => void;
}) {
  const { navigate } = useProductActions();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "button flex h-[36px] items-center gap-[8px] rounded-[var(--radius-md)] pl-[8px] pr-[10px]",
          "border border-[var(--border)] bg-[rgba(255,255,255,0.04)] text-[var(--text-soft)]",
          "hover:bg-[rgba(255,255,255,0.07)] hover:border-[var(--border-strong)] hover:text-[var(--text)]",
          "transition-all duration-[140ms] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
        )}
        aria-label="User menu"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Avatar
          src={user?.image}
          alt={user?.name ?? "User"}
          size="xs"
          status="online"
        />
        <span className="hidden max-w-[88px] truncate text-[12px] font-medium text-[var(--text)] sm:block">
          {user?.name ?? "User"}
        </span>
        <ChevronDown
          className={cn(
            "hidden size-3 text-[var(--muted)] transition-transform sm:block",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0" onClick={close} aria-hidden />

          {/* Dropdown */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{    opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-[calc(100%+8px)] w-[176px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-panel)]"
            style={{ zIndex: 80 }}
          >
            {([
              { label: "Dashboard", href: "/dashboard" },
              { label: "Settings",  href: "/settings"  },
            ] as const).map(({ label, href }) => (
              <button
                key={href}
                onClick={() => { navigate(href); close(); }}
                className="w-full px-[14px] py-[9px] text-left text-[13px] text-[var(--text-soft)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
              >
                {label}
              </button>
            ))}
            <div className="border-t border-[var(--border)]">
              <button
                onClick={() => { close(); onSignOut(); }}
                className="w-full px-[14px] py-[9px] text-left text-[13px] text-[var(--danger)] transition-colors hover:bg-[var(--panel-2)]"
              >
                Sign out
              </button>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
