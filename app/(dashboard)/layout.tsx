import type { ReactNode } from "react";
import { Nav } from "@/components/layout/nav";

/**
 * Authenticated app shell. Previously this returned `children` bare, so every
 * dashboard/admin page (settings, notifications, /control/admin/*) rendered with
 * NO topbar and no way back to the site except editing the address bar.
 *
 * The site Nav is reused deliberately: it already reflects auth state and links
 * home, so admin surfaces stay navigable without a second competing header.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell flex min-h-screen flex-col bg-[var(--surface-base)]">
      <Nav />
      <main className="site-main flex-1 pt-24">{children}</main>
    </div>
  );
}
