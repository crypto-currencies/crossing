"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ArrowLeft, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm({ emailAvailable }: { emailAvailable: boolean }) {
  const [email, setEmail]     = useState("");
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      // Always show "sent" regardless of whether the account exists
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!emailAvailable) {
    return (
      <div className="flex flex-col gap-[24px]">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--text)" }}>
            Password reset unavailable
          </h1>
          <p className="mt-[6px] t-body-sm" style={{ color: "var(--text-soft)" }}>
            Email sending is not configured for this deployment.
          </p>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] px-[16px] py-[18px] flex gap-[10px]">
          <WifiOff className="size-4 flex-shrink-0 mt-[1px]" style={{ color: "var(--muted)" }} />
          <p className="t-body-sm" style={{ color: "var(--text-soft)" }}>
            Contact support if you&apos;re locked out of your account.
          </p>
        </div>
        <Link href="/login" className="flex items-center gap-[6px] t-body-sm" style={{ color: "var(--text-soft)" }}>
          <ArrowLeft className="size-3.5" />
          Back to sign in
        </Link>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-[24px]">
        <div className="flex flex-col items-center gap-[12px] text-center py-[12px]">
          <CheckCircle2 className="size-10" style={{ color: "var(--success)" }} />
          <div>
            <p className="text-[17px] font-semibold" style={{ color: "var(--text)" }}>Check your inbox</p>
            <p className="mt-[6px] t-body-sm" style={{ color: "var(--text-soft)" }}>
              If an account exists for <strong>{email}</strong>, we&apos;ve sent a reset link.
              It expires in 1 hour.
            </p>
          </div>
        </div>
        <p className="t-caption text-center" style={{ color: "var(--muted)" }}>
          Didn&apos;t receive it? Check your spam folder, or{" "}
          <button
            className="underline underline-offset-2 hover:opacity-80"
            onClick={() => setSent(false)}
          >
            try again
          </button>.
        </p>
        <Link href="/login" className="flex items-center justify-center gap-[6px] t-body-sm" style={{ color: "var(--text-soft)" }}>
          <ArrowLeft className="size-3.5" />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[24px]">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--text)" }}>
          Forgot your password?
        </h1>
        <p className="mt-[6px] t-body-sm" style={{ color: "var(--text-soft)" }}>
          Enter your email and we&apos;ll send a reset link if an account exists.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-[14px]">
        <Input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(null); }}
          autoComplete="email"
          autoFocus
        />
        {error && (
          <p className="t-caption" style={{ color: "var(--danger)" }}>{error}</p>
        )}
        <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
          Send reset link
        </Button>
      </form>

      <Link href="/login" className="flex items-center gap-[6px] t-body-sm" style={{ color: "var(--text-soft)" }}>
        <ArrowLeft className="size-3.5" />
        Back to sign in
      </Link>
    </div>
  );
}
