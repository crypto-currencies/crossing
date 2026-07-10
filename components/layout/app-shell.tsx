"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui";
import { Nav } from "./nav";
import { PageShell } from "./surface";
import { Sidebar } from "./sidebar";

interface AppShellProps {
  children: React.ReactNode;
  /** Render the sidebar (authenticated app pages only) */
  sidebar?: boolean;
  /** Footer node rendered inside <main> below the page content */
  footer?: React.ReactNode;
  className?: string;
  pageSize?: "content" | "hero" | "browse" | "dashboard" | "wide";
}

const HOVER_OPEN_DELAY  = 180;
const HOVER_CLOSE_DELAY = 220;

export function AppShell({
  children,
  sidebar = false,
  footer,
  className,
  pageSize,
}: AppShellProps) {
  const { sidebarPinned, setSidebarHoverIntent, setSidebarOpen } = useUIStore();

  const shellPageSize = pageSize ?? (sidebar ? "dashboard" : "hero");

  // ── Hover-expand timers ────────────────────────────────────────────────────
  const openTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOpen  = () => { if (openTimer.current)  { clearTimeout(openTimer.current);  openTimer.current  = null; } };
  const clearClose = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } };

  const requestSidebarOpen = () => {
    if (!sidebar) return;
    clearClose();
    clearOpen();
    openTimer.current = setTimeout(() => setSidebarHoverIntent(true), HOVER_OPEN_DELAY);
  };

  const requestSidebarClose = () => {
    if (!sidebar || sidebarPinned) return;
    clearOpen();
    clearClose();
    closeTimer.current = setTimeout(() => setSidebarHoverIntent(false), HOVER_CLOSE_DELAY);
  };

  useEffect(() => () => { clearOpen(); clearClose(); }, []);

  // ── Derived layout classes ─────────────────────────────────────────────────
  //
  // The sidebar is position:fixed.  The <main> must push its left edge to the
  // right of the collapsed sidebar rail so content is never hidden under it.
  // When the sidebar is pinned-open the push widens to the full sidebar width.
  // Hover-expand is overlay-only (no layout shift) — intentional UX behaviour.
  //
  const mainOffset = sidebar
    ? sidebarPinned
      ? "lg:pl-[var(--sidebar-width)]"
      : "lg:pl-[var(--sidebar-collapsed)]"
    : "";

  return (
    <div
      className={cn("flex min-h-dvh w-full flex-col bg-[var(--bg)]", className)}
    >
      {/* ── Fixed top bar ─────────────────────────────────────────────────── */}
      <Nav showSidebarToggle={sidebar} />

      {/* ── Fixed sidebar (auth pages only) ───────────────────────────────── */}
      {sidebar && (
        <>
          {/*
           * Invisible hover zone that triggers sidebar open.
           * Sits between the page edge and the first content pixel,
           * above the sidebar (z-41) so mouse events still reach it
           * when the sidebar is collapsed.
           */}
          <button
            type="button"
            aria-label="Open sidebar"
            className="fixed left-0 top-[var(--topbar-height)] bottom-0 z-[41] hidden w-3 cursor-default bg-transparent lg:block"
            onMouseEnter={requestSidebarOpen}
            onFocus={requestSidebarOpen}
            onClick={() => setSidebarHoverIntent(true)}
          />
          <Sidebar
            onRequestOpen={requestSidebarOpen}
            onRequestClose={requestSidebarClose}
          />
        </>
      )}

      {/*
       * ── Main scrollable area ────────────────────────────────────────────
       *
       * pt-[topbar-height]     → clears the fixed topbar
       * transition-[padding-left] → animates the sidebar width change
       * mainOffset             → reserves space for the sidebar rail
       *
       * flex-col + flex-1 on PageShell wrapper lets the footer sit at
       * the bottom of the viewport when there isn't enough content to fill it.
       */}
      <main
        className={cn(
          "flex min-h-dvh flex-col w-full min-w-0",
          "pt-[var(--topbar-height)]",
          "transition-[padding-left] duration-200 ease-out",
          mainOffset
        )}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setSidebarHoverIntent(false);
            setSidebarOpen(false);
          }
        }}
      >
        {/* Page content */}
        <div className="flex-1">
          <PageShell size={shellPageSize}>
            {children}
          </PageShell>
        </div>

        {/* Footer — full width within main, inherits sidebar offset */}
        {footer}
      </main>

      {/* Bottom depth overlay removed from shell — rendered only on pages that
          explicitly request it (currently the homepage only). This prevents the
          gradient from darkening the footer or non-marketing page content. */}
    </div>
  );
}
