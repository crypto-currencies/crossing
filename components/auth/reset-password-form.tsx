"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();

  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";

  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const missingParams = !token || !email;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm)  { setError("Passwords do not match."); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password }),
      });
      if (res.ok) {
        setDone(true);
        setTimeout(() => router.push("/login"), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        const MSG: Record<string, string> = {
          invalid_token:     "This reset link is invalid or has expired. Request a new one.",
          token_already_used:"This reset link has already been used.",
          token_expired:     "This reset link has expired. Request a new one.",
          password_too_short:"Password must be at least 8 characters.",
        };
        setError(MSG[data.error] ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (missingParams) {
    return (
      <div className="flex flex-col gap-[20px]">
        <div className="flex items-start gap-[12px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] px-[16px] py-[18px]">
          <AlertCircle className="size-4 flex-shrink-0 mt-[1px]" style={{ color: "var(--danger)" }} />
          <div>
            <p className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>Invalid reset link</p>
            <p className="mt-[4px] t-caption" style={{ color: "var(--text-soft)" }}>
              This link is missing required parameters. Request a new one from the login page.
            </p>
          </div>
        </div>
        <Link href="/forgot-password" className="flex items-center gap-[6px] t-body-sm" style={{ color: "var(--text-soft)" }}>
          <ArrowLeft className="size-3.5" />
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-[12px] py-[24px] text-center">
        <CheckCircle2 className="size-10" style={{ color: "var(--success)" }} />
        <p className="text-[17px] font-semibold" style={{ color: "var(--text)" }}>Password updated</p>
        <p className="t-body-sm" style={{ color: "var(--text-soft)" }}>
          All your sessions have been signed out. Redirecting to sign in…
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[24px]">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--text)" }}>
          Set a new password
        </h1>
        <p className="mt-[6px] t-body-sm" style={{ color: "var(--text-soft)" }}>
          Choose a strong password for{" "}
          <span className="font-medium" style={{ color: "var(--text)" }}>{email}</span>.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-[14px]">
        <Input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(null); }}
          autoComplete="new-password"
          autoFocus
          minLength={8}
        />
        <Input
          type="password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setError(null); }}
          autoComplete="new-password"
        />
        {error && (
          <p className="t-caption" style={{ color: "var(--danger)" }}>{error}</p>
        )}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          disabled={!password || !confirm}
          className="w-full"
        >
          Update password
        </Button>
      </form>

      <Link href="/forgot-password" className="flex items-center gap-[6px] t-body-sm" style={{ color: "var(--text-soft)" }}>
        <ArrowLeft className="size-3.5" />
        Request a different link
      </Link>
    </div>
  );
}
