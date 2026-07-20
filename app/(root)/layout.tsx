import type { ReactNode } from "react";
import { Nav } from "@/components/layout/nav";
import { Footer } from "@/components/layout/footer";

export default function RootRouteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell flex min-h-screen flex-col bg-[var(--surface-base)]">
      <Nav />
      <main className="site-main flex-1 pt-24">{children}</main>
      <Footer />
    </div>
  );
}
