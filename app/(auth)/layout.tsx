import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Bookmark, FileCheck2, Search } from "lucide-react";
import { Logo } from "@/components/ui/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <aside className="auth-shell-brand">
        <div className="auth-shell-top">
          <Logo />
          <Link href="/"><ArrowLeft size={15} aria-hidden /> Back to Crossing</Link>
        </div>
        <div className="auth-story">
          <p className="product-eyebrow">What’s worth your time?</p>
          <h2>Search with context. Keep only what holds up.</h2>
          <p>Crossing makes the reason, evidence, and compromise part of the recommendation.</p>
          <div>
            <span><Search size={17} aria-hidden /> Search with real constraints</span>
            <span><Bookmark size={17} aria-hidden /> Return to confirmed saves</span>
            <span><FileCheck2 size={17} aria-hidden /> Track supported contributions</span>
          </div>
        </div>
      </aside>
      <main className="auth-shell-main">
        <div className="auth-mobile-logo"><Logo /></div>
        {children}
      </main>
    </div>
  );
}
