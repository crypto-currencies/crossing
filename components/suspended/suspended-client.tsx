"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Calendar, LogOut, Mail } from "lucide-react";

// ─── Main client ──────────────────────────────────────────────────────────────

export function SuspendedClient({
  suspendedAt,
  suspendedReason,
  username,
}: {
  suspendedAt:     string;
  suspendedReason: string | null;
  username:        string | null;
}) {
  const router = useRouter();

  const formattedDate = new Date(suspendedAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const handleSignOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
  }, [router]);

  return (
    <div className="relative min-h-screen" style={{ background: "#070709" }}>
      <div className="flex min-h-screen flex-col items-center justify-center px-[20px] py-[60px]">

        {/* Logo */}
        <Link
          href="/"
          className="mb-[48px] font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-white/25 transition-colors hover:text-white/50"
        >
          crossing.dev
        </Link>

        {/* Card */}
        <div
          className="w-full max-w-[480px] overflow-hidden rounded-[20px]"
          style={{ border: "1px solid rgba(192,72,72,0.22)", background: "rgba(12,10,14,0.95)" }}
        >
          {/* Header strip */}
          <div
            className="px-[28px] py-[24px]"
            style={{ background: "rgba(192,72,72,0.06)", borderBottom: "1px solid rgba(192,72,72,0.14)" }}
          >
            <div className="flex items-center gap-[12px]">
              <div
                className="flex size-[42px] flex-shrink-0 items-center justify-center rounded-full"
                style={{ background: "rgba(192,72,72,0.12)", border: "1px solid rgba(192,72,72,0.25)" }}
              >
                <Ban className="size-[19px]" style={{ color: "#c04848" }} />
              </div>
              <div>
                <p className="text-[16px] font-bold text-white leading-none">Account suspended</p>
                {username && (
                  <p className="mt-[3px] text-[13px] text-white/40">@{username}</p>
                )}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-[20px] px-[28px] py-[24px]">
            {/* Explanation */}
            <div className="flex flex-col gap-[10px]">
              <p className="text-[13px] text-white/65 leading-relaxed">
                Your account has been suspended due to a violation of our{" "}
                <Link href="/policies" className="text-white/80 underline decoration-dotted hover:text-white transition-colors">
                  Content Policy
                </Link>
                . During this period you cannot access your account or use platform features.
              </p>

              {/* Suspension date */}
              <div className="flex items-center gap-[7px] text-[12px] text-white/40">
                <Calendar className="size-[11px] flex-shrink-0" />
                Suspended on {formattedDate}
              </div>

              {/* Reason (if provided) */}
              {suspendedReason && (
                <div
                  className="rounded-[10px] px-[14px] py-[11px]"
                  style={{ background: "rgba(192,72,72,0.06)", border: "1px solid rgba(192,72,72,0.16)" }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30 mb-[4px]">
                    Reason provided
                  </p>
                  <p className="text-[13px] text-white/60 leading-relaxed">{suspendedReason}</p>
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

            {/* Contact support */}
            <a
              href="mailto:support@crossing.dev"
              className="flex items-center gap-[10px] rounded-[10px] border px-[14px] py-[12px] transition-colors"
              style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)" }}
            >
              <Mail className="size-[14px] flex-shrink-0 text-white/35" />
              <div className="text-left">
                <p className="text-[13px] font-medium text-white leading-none">Contact support</p>
                <p className="mt-[2px] text-[11px] text-white/40">
                  If you believe this was a mistake, email support@crossing.dev.
                </p>
              </div>
            </a>

            {/* Sign out */}
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-[7px] text-[12px] text-white/30 transition-colors hover:text-white/55 mx-auto"
            >
              <LogOut className="size-[12px]" />
              Sign out
            </button>
          </div>
        </div>

        {/* Footer links */}
        <div className="mt-[32px] flex items-center gap-[20px]">
          {[
            { href: "/terms",    label: "Terms of Service" },
            { href: "/policies", label: "Policies"         },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-[11px] text-white/25 transition-colors hover:text-white/50"
            >
              {label}
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
