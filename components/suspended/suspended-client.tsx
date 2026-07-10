"use client";

import { useState, useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ban,
  Calendar,
  FileText,
  LogOut,
  Send,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

// ─── Appeal categories ────────────────────────────────────────────────────────

const APPEAL_CATEGORIES = [
  { value: "appeal",  label: "Suspension appeal",       desc: "Contest this suspension decision"         },
  { value: "account", label: "Account recovery / info", desc: "Questions about your account status"      },
  { value: "other",   label: "Other",                   desc: "Anything not listed above"                },
];

// ─── Appeal form ──────────────────────────────────────────────────────────────

function AppealForm() {
  const [category,    setCategory]    = useState("appeal");
  const [subject,     setSubject]     = useState("Suspension appeal");
  const [description, setDescription] = useState("");
  const [submitting,  startSubmit]    = useTransition();
  const [submitted,   setSubmitted]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const submit = useCallback(() => {
    if (!subject.trim() || description.trim().length < 20) return;
    setError(null);
    startSubmit(async () => {
      try {
        const res  = await fetch("/api/tickets", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ category, subject: subject.trim(), description: description.trim() }),
        });
        const json = await res.json() as { error?: string };
        if (!res.ok) {
          setError(
            json.error === "too_many_open_tickets"
              ? "You already have an open appeal. Check your email for updates."
              : json.error ?? "Failed to submit. Please try again."
          );
          return;
        }
        setSubmitted(true);
      } catch {
        setError("Network error — please try again.");
      }
    });
  }, [category, description, subject]);

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-[16px] py-[16px] text-center">
        <div
          className="flex size-[52px] items-center justify-center rounded-full"
          style={{ background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.22)" }}
        >
          <CheckCircle2 className="size-[24px]" style={{ color: "#22c55e" }} />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-white">Appeal submitted</p>
          <p className="mt-[6px] text-[13px] text-white/55 leading-relaxed">
            Our team will review your case and respond within 24–48 hours. If approved, your account
            will be reinstated automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[14px]">
      {/* Category */}
      <div>
        <p className="mb-[8px] text-[12px] font-semibold text-white/50 uppercase tracking-wider">
          Request type
        </p>
        <div className="flex flex-col gap-[5px]">
          {APPEAL_CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => {
                setCategory(c.value);
                if (c.value === "appeal") setSubject("Suspension appeal");
              }}
              className={cn(
                "flex items-start gap-[10px] rounded-[10px] border px-[12px] py-[10px] text-left transition-colors",
                category === c.value
                  ? "border-[rgba(139,92,246,0.45)] bg-[rgba(139,92,246,0.08)]"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20"
              )}
            >
              <span className={cn(
                "mt-[3px] size-3 rounded-full border-2 flex-shrink-0 transition-colors",
                category === c.value ? "border-[#8B5CF6] bg-[#8B5CF6]" : "border-white/25"
              )} />
              <span className="flex flex-col gap-[1px]">
                <span className="text-[13px] font-medium text-white leading-snug">{c.label}</span>
                <span className="text-[11px] text-white/40 leading-snug">{c.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Subject */}
      <div>
        <label className="mb-[6px] block text-[12px] font-semibold text-white/50 uppercase tracking-wider">
          Subject
        </label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={120}
          placeholder="Brief description"
          className="w-full rounded-[10px] border border-white/10 bg-white/[0.04] px-[12px] py-[10px] text-[13px] text-white placeholder:text-white/25 focus:border-[rgba(139,92,246,0.5)] focus:outline-none focus:ring-1 focus:ring-[rgba(139,92,246,0.25)] transition-colors"
        />
      </div>

      {/* Message */}
      <div>
        <label className="mb-[6px] block text-[12px] font-semibold text-white/50 uppercase tracking-wider">
          Your message
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="Explain your situation in detail. Include any context that may help us review your case."
          className="w-full resize-none rounded-[10px] border border-white/10 bg-white/[0.04] px-[12px] py-[10px] text-[13px] text-white placeholder:text-white/25 focus:border-[rgba(139,92,246,0.5)] focus:outline-none focus:ring-1 focus:ring-[rgba(139,92,246,0.25)] transition-colors"
        />
        <p className="mt-[4px] text-[11px] text-white/30">
          {description.trim().length}/2000 · Minimum 20 characters
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-[8px] rounded-[9px] px-[12px] py-[10px]"
          style={{ background: "rgba(192,72,72,0.09)", border: "1px solid rgba(192,72,72,0.22)" }}>
          <AlertTriangle className="size-[13px] flex-shrink-0 text-[#c04848]" />
          <p className="text-[12px] text-[#c04848]">{error}</p>
        </div>
      )}

      <Button
        variant="primary"
        size="md"
        disabled={!subject.trim() || description.trim().length < 20 || submitting}
        onClick={submit}
        loading={submitting}
      >
        <Send className="size-3.5" />
        Submit appeal
      </Button>
    </div>
  );
}

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
  const [showAppeal, setShowAppeal] = useState(false);

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

            {/* Appeal toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowAppeal((v) => !v)}
                className="flex w-full items-center justify-between gap-[10px] rounded-[10px] border px-[14px] py-[12px] transition-colors"
                style={{
                  background:  showAppeal ? "rgba(139,92,246,0.07)" : "rgba(255,255,255,0.02)",
                  borderColor: showAppeal ? "rgba(139,92,246,0.35)" : "rgba(255,255,255,0.08)",
                }}
              >
                <div className="flex items-center gap-[10px]">
                  <FileText className="size-[14px] flex-shrink-0" style={{ color: showAppeal ? "#8B5CF6" : "rgba(255,255,255,0.35)" }} />
                  <div className="text-left">
                    <p className="text-[13px] font-medium text-white leading-none">Submit an appeal</p>
                    <p className="mt-[2px] text-[11px] text-white/40">
                      If you believe this was a mistake, contact our support team.
                    </p>
                  </div>
                </div>
                <ChevronDown
                  className="size-[14px] flex-shrink-0 transition-transform"
                  style={{
                    color:     "rgba(255,255,255,0.30)",
                    transform: showAppeal ? "rotate(180deg)" : "none",
                  }}
                />
              </button>

              {showAppeal && (
                <div className="mt-[12px]">
                  <AppealForm />
                </div>
              )}
            </div>

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
            { href: "/community", label: "Community Guidelines" },
            { href: "/terms",     label: "Terms of Service"     },
            { href: "/policies",  label: "Policies"             },
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
