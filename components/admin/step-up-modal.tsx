"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ShieldCheck, Mail, KeyRound, RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModalStep =
  | "idle"        // "Send code" prompt
  | "requesting"  // sending email
  | "code_sent"   // code input + countdown
  | "confirming"  // verifying code
  | "success"     // brief success flash
  | "error";      // unrecoverable error

interface StepUpModalProps {
  onVerified: (expiresAt: string) => void;
  onClose:    () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CODE_TTL_SECONDS    = 10 * 60; // matches server
const RESEND_COOLDOWN_S   = 60;      // seconds before resend allowed

// ─── Countdown hook ───────────────────────────────────────────────────────────

function useCountdown(initialSeconds: number, active: boolean) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (!active) return;
    setSeconds(initialSeconds);
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) { clearInterval(id); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [active, initialSeconds]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return { seconds, display: `${mm}:${ss}` };
}

// ─── StepUpModal ─────────────────────────────────────────────────────────────

export function StepUpModal({ onVerified, onClose }: StepUpModalProps) {
  const [step, setStep]             = useState<ModalStep>("idle");
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [code, setCode]             = useState("");
  const [error, setError]           = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);

  // countdown for code expiry (shown while in code_sent step)
  const codeCountdown   = useCountdown(CODE_TTL_SECONDS, step === "code_sent" || step === "confirming");
  // countdown for resend cooldown
  const resendCountdown = useCountdown(
    RESEND_COOLDOWN_S,
    (step === "code_sent" || step === "confirming") && lastSentAt !== null
  );
  const canResend = resendCountdown.seconds === 0 && (step === "code_sent" || step === "confirming");

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (step === "code_sent") {
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [step]);

  // ── Request code ───────────────────────────────────────────────────────────
  const requestCode = useCallback(async () => {
    setStep("requesting");
    setError(null);
    try {
      const res  = await fetch("/api/admin/verify/request", { method: "POST" });
      const json = await res.json() as { ok?: boolean; maskedEmail?: string; error?: string; message?: string };
      if (!res.ok) {
        const msg =
          json.error === "rate_limited"    ? "Too many requests. Please wait before requesting another code." :
          json.error === "admin_no_email"  ? "Your admin account has no email on file. Contact the platform owner." :
          json.message                     ? json.message :
          "Failed to send code. Please try again.";
        setError(msg);
        setStep("error");
        return;
      }
      setMaskedEmail(json.maskedEmail ?? null);
      setCode("");
      setLastSentAt(Date.now());
      setStep("code_sent");
    } catch {
      setError("Network error. Please check your connection and try again.");
      setStep("error");
    }
  }, []);

  // ── Confirm code ───────────────────────────────────────────────────────────
  const confirmCode = useCallback(async () => {
    if (code.replace(/\D/g, "").length !== 6) return;
    setStep("confirming");
    setError(null);
    try {
      const res  = await fetch("/api/admin/verify/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json() as {
        ok?: boolean; expiresAt?: string;
        error?: string; message?: string; attemptsLeft?: number;
      };
      if (!res.ok) {
        const msg =
          json.error === "no_active_challenge" ? "No code found. Request a new one." :
          json.error === "expired_code"        ? "Your code has expired. Request a new one." :
          json.error === "code_already_used"   ? "That code was already used. Request a new one." :
          json.error === "too_many_attempts"   ? "Too many incorrect attempts. Request a new one." :
          json.message                         ? json.message :
          "Invalid code. Please try again.";
        setError(msg);
        if (typeof json.attemptsLeft === "number") setAttemptsLeft(json.attemptsLeft);
        // Codes that can't be retried (expired/used/exhausted/missing) reset to idle
        const unrecoverable =
          json.attemptsLeft === 0 ||
          json.error === "no_active_challenge" ||
          json.error === "expired_code" ||
          json.error === "code_already_used" ||
          json.error === "too_many_attempts";
        setStep(unrecoverable ? "idle" : "code_sent");
        return;
      }
      setStep("success");
      setTimeout(() => {
        if (json.expiresAt) onVerified(json.expiresAt);
      }, 900);
    } catch {
      setError("Network error. Please try again.");
      setStep("code_sent");
    }
  }, [code, onVerified]);

  // ── Key handler ────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && step === "code_sent" && code.replace(/\D/g, "").length === 6) {
      void confirmCode();
    }
  }, [code, confirmCode, step]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Modal
      open
      onClose={step === "requesting" || step === "confirming" || step === "success" ? () => {} : onClose}
      title=""
      size="sm"
    >
      <div className="flex flex-col gap-[20px]">

        {/* ── Success ───────────────────────────────────────────────────── */}
        {step === "success" && (
          <div className="flex flex-col items-center gap-[14px] py-[12px] text-center">
            <div className="flex size-[52px] items-center justify-center rounded-full"
              style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" }}>
              <CheckCircle2 className="size-[24px]" style={{ color: "var(--success)" }} />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-[var(--text)]">Verified</p>
              <p className="t-caption mt-[4px]">Your session is verified for 10 minutes.</p>
            </div>
          </div>
        )}

        {/* ── Idle — "Send code" ────────────────────────────────────────── */}
        {(step === "idle" || step === "error") && (
          <>
            {/* Icon + header */}
            <div className="flex flex-col items-center gap-[12px] text-center">
              <div className="flex size-[48px] items-center justify-center rounded-[var(--radius-md)]"
                style={{ background: "rgba(109,40,217,0.14)", border: "1px solid rgba(109,40,217,0.30)" }}>
                <ShieldCheck className="size-[22px]" style={{ color: "var(--accent-text)" }} />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[var(--text)]">Verify your identity</p>
                <p className="t-caption mt-[3px] max-w-[300px]">
                  This action requires step-up verification. We&rsquo;ll send a one-time code to your admin email.
                </p>
              </div>
            </div>

            {/* Security note */}
            <div className="flex items-start gap-[8px] rounded-[10px] px-[12px] py-[10px]"
              style={{ background: "rgba(109,40,217,0.06)", border: "1px solid rgba(109,40,217,0.16)" }}>
              <KeyRound className="size-[13px] flex-shrink-0 mt-[2px]" style={{ color: "var(--accent-text)" }} />
              <p className="t-caption" style={{ color: "var(--accent-text)" }}>
                Codes expire in 10 minutes and can only be used once. If you didn&rsquo;t trigger this action, your session may be compromised.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-[8px] rounded-[10px] px-[12px] py-[10px]"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}>
                <XCircle className="size-[13px] flex-shrink-0 mt-[1px] text-[var(--danger)]" />
                <p className="t-caption text-[var(--danger)]">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-[8px]">
              <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
              <Button variant="primary" size="md" onClick={() => void requestCode()}>
                <Mail className="size-[13px]" /> Send code
              </Button>
            </div>
          </>
        )}

        {/* ── Requesting ───────────────────────────────────────────────── */}
        {step === "requesting" && (
          <div className="flex flex-col items-center gap-[12px] py-[16px] text-center">
            <RefreshCw className="size-[24px] animate-spin" style={{ color: "var(--accent-text)" }} />
            <p className="t-body-sm text-[var(--text-soft)]">Sending verification code…</p>
          </div>
        )}

        {/* ── Code sent / Confirming ────────────────────────────────────── */}
        {(step === "code_sent" || step === "confirming") && (
          <>
            {/* Header */}
            <div className="flex flex-col items-center gap-[10px] text-center">
              <div className="flex size-[48px] items-center justify-center rounded-[var(--radius-md)]"
                style={{ background: "rgba(109,40,217,0.14)", border: "1px solid rgba(109,40,217,0.30)" }}>
                <Mail className="size-[22px]" style={{ color: "var(--accent-text)" }} />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[var(--text)]">Check your email</p>
                <p className="t-caption mt-[3px]">
                  We sent a 6-digit code
                  {maskedEmail ? <> to <strong className="text-[var(--text)]">{maskedEmail}</strong></> : ""}.
                </p>
              </div>
            </div>

            {/* Expiry countdown */}
            <div className="flex items-center justify-center gap-[5px]">
              <Clock className="size-[11px]" style={{ color: codeCountdown.seconds < 60 ? "var(--danger)" : "var(--muted)" }} />
              <p className="t-caption tabular-nums"
                style={{ color: codeCountdown.seconds < 60 ? "var(--danger)" : "var(--muted)" }}>
                {codeCountdown.seconds > 0 ? `Expires in ${codeCountdown.display}` : "Code expired — request a new one"}
              </p>
            </div>

            {/* Code input */}
            <div className="flex flex-col gap-[6px]">
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(v);
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="000000"
                disabled={step === "confirming" || codeCountdown.seconds === 0}
                className={cn(
                  "w-full rounded-[10px] border bg-[var(--panel-2)] py-[14px]",
                  "text-center font-mono text-[28px] font-bold tracking-[0.22em]",
                  "placeholder:text-[var(--muted)] placeholder:font-normal placeholder:tracking-normal",
                  "focus:outline-none transition-colors",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  error
                    ? "border-[var(--danger)] text-[var(--danger)]"
                    : "border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)]"
                )}
                style={{ letterSpacing: "0.22em" }}
                aria-label="Verification code"
                autoComplete="one-time-code"
              />

              {/* Attempts warning */}
              {attemptsLeft !== null && attemptsLeft > 0 && (
                <p className="t-caption text-[var(--warning)] text-center">
                  {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining
                </p>
              )}

              {/* Error */}
              {error && (
                <p className="t-caption text-[var(--danger)] text-center">{error}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-[8px]">
              <button
                type="button"
                disabled={!canResend || step === "confirming"}
                onClick={() => { setCode(""); setError(null); setAttemptsLeft(null); void requestCode(); }}
                className={cn(
                  "flex items-center gap-[5px] t-caption transition-colors",
                  canResend && step !== "confirming"
                    ? "text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
                    : "text-[var(--muted)] opacity-50 cursor-not-allowed"
                )}
              >
                <RefreshCw className="size-[11px]" />
                {canResend ? "Resend code" : `Resend in ${resendCountdown.display}`}
              </button>

              <div className="flex gap-[8px]">
                <Button variant="ghost" size="md" disabled={step === "confirming"} onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  disabled={code.replace(/\D/g, "").length !== 6 || step === "confirming" || codeCountdown.seconds === 0}
                  loading={step === "confirming"}
                  onClick={() => void confirmCode()}
                >
                  Verify
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
