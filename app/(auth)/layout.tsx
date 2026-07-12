import Link from "next/link";
import { LogoMark, LogoBadge, LogoGlyph } from "@/components/ui/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[var(--bg)]">

      {/* ── Left brand panel (desktop only) ─────────────────────────── */}
      <aside className="hidden md:flex md:w-[420px] lg:w-[480px] flex-shrink-0 flex-col justify-between p-[48px] border-r border-[var(--border)] relative overflow-hidden">
        {/* Subtle grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px),
                              linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
        {/* Large watermark C mark — bottom-right, very faint */}
        <div
          className="pointer-events-none absolute -bottom-[60px] -right-[60px] opacity-[0.04]"
          aria-hidden
        >
          <LogoGlyph size={320} />
        </div>
        {/* Purple radial bloom behind the badge area */}
        <div
          className="pointer-events-none absolute left-0 top-[30%] w-[300px] h-[300px] -translate-x-1/2 opacity-30"
          style={{
            background: "radial-gradient(circle, rgba(109,40,217,0.35) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
          aria-hidden
        />

        {/* Logo — small wordmark at top */}
        <div>
          <Link href="/" className="flex items-center gap-[10px] w-fit group">
            <LogoMark size={24} />
            <span className="font-bold text-[14px] tracking-tight text-[var(--text-soft)] group-hover:text-[var(--text)] transition-colors">
              crossing<span className="text-[var(--muted)]">.dev</span>
            </span>
          </Link>
        </div>

        {/* Value prop */}
        <div className="space-y-[32px]">
          {/* Badge — centrepiece */}
          <div className="flex flex-col gap-[20px]">
            <LogoBadge size={72} glow />
            <div>
              <h2
                className="font-black text-[var(--text)] leading-[0.9] tracking-[-0.03em] uppercase"
                style={{ fontSize: "clamp(34px, 3.8vw, 46px)" }}
              >
                Find what&apos;s
                <br />
                worth it.
              </h2>
              <p className="t-body text-[var(--muted)] mt-[14px] max-w-[260px]">
                Discover products, services, tools, and communities worth your time.
              </p>
            </div>
          </div>

          {/* Feature callouts */}
          <div className="flex flex-col gap-[8px]">
            {[
              {
                label: "Curated discovery",
                sub:   "Find the things worth your time, in one place.",
              },
              {
                label: "Built for the long run",
                sub:   "A foundation that grows with the product.",
              },
              {
                label: "Yours to shape",
                sub:   "The full product is still being built out.",
              },
            ].map(({ label, sub }) => (
              <div
                key={label}
                className="flex items-start gap-[12px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-[14px] py-[12px]"
              >
                <span className="mt-[4px] size-[5px] flex-shrink-0 rounded-full bg-[var(--accent)]" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-snug text-[var(--text)]">{label}</p>
                  <p className="t-caption mt-[2px] leading-snug">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer links */}
        <div className="flex items-center gap-[16px]">
          <Link href="/terms"    className="t-caption text-[var(--muted)] hover:text-[var(--text-soft)] transition-colors">Terms</Link>
          <Link href="/privacy"  className="t-caption text-[var(--muted)] hover:text-[var(--text-soft)] transition-colors">Privacy</Link>
          <Link href="/policies" className="t-caption text-[var(--muted)] hover:text-[var(--text-soft)] transition-colors">Rules</Link>
          <span className="t-caption text-[var(--muted)] ml-auto">&copy; {new Date().getFullYear()} crossing.dev</span>
        </div>
      </aside>

      {/* ── Right form panel ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen md:min-h-0">

        {/* Mobile-only header */}
        <header className="md:hidden flex items-center px-[20px] h-[56px] border-b border-[var(--border)]">
          <Link href="/" className="flex items-center gap-[10px] group">
            <LogoMark size={24} />
            <span className="font-bold text-[14px] tracking-normal text-[var(--text)]">
              crossing<span className="text-[var(--muted)]">.dev</span>
            </span>
          </Link>
        </header>

        {/* Centered form */}
        <main className="flex-1 flex items-center justify-center p-[24px] md:p-[48px]">
          <div className="w-full max-w-[420px]">
            {children}
          </div>
        </main>

        {/* Mobile footer */}
        <footer className="md:hidden py-[20px] text-center border-t border-[var(--border)]">
          <div className="flex items-center justify-center gap-[14px]">
            <Link href="/terms"    className="t-caption text-[var(--muted)] hover:text-[var(--text-soft)] transition-colors">Terms</Link>
            <Link href="/privacy"  className="t-caption text-[var(--muted)] hover:text-[var(--text-soft)] transition-colors">Privacy</Link>
            <Link href="/policies" className="t-caption text-[var(--muted)] hover:text-[var(--text-soft)] transition-colors">Rules</Link>
          </div>
        </footer>
      </div>

    </div>
  );
}
