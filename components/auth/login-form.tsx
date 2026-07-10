"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn as nextAuthSignIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/store/auth";
import { useToastStore } from "@/store/toast";
import { authService } from "@/lib/services/auth.service";
import { validateRedirect } from "@/lib/redirect";
import { cn } from "@/lib/utils";
import { CheckCircle2, Mail, AlertCircle, Clock, WifiOff, ShieldCheck } from "lucide-react";

type Tab = "password" | "magic";

// ─── Magic-link UI states ─────────────────────────────────────────────────────

type MagicState =
  | "idle"           // form ready for input
  | "sending"        // request in-flight
  | "sent"           // email dispatched successfully
  | "invalid_email"  // client-side validation failure
  | "email_failed"   // Resend/transport error
  | "provider_unavailable"; // RESEND_API_KEY / EMAIL_FROM not configured

// ─── URL error codes from /api/auth/magic-link/verify redirects ───────────────

const OAUTH_ERRORS: Record<string, string> = {
  oauth_failed:           "Sign-in failed. Please try again.",
  invalid_session:        "Your session was invalid. Please sign in again.",
  invalid_link:           "That sign-in link is invalid or has already been used.",
  link_expired:           "That sign-in link has expired. Request a new one below.",
  db_unavailable:         "Service temporarily unavailable. Please try again shortly.",
  provider_unavailable:   "Email sign-in is not configured for this deployment.",
  user_create_failed:     "Could not create your account. Please try again.",
  account_suspended:      "This account has been suspended. Contact support if you believe this is a mistake.",
  // Provider-level rejections (error code appears in the URL)
  invalid_oauth2_token:   "Sign-in was rejected by the provider. Please try again.",
  redirect_uri_mismatch:  "Sign-in configuration error. Please contact support.",
  OAuthCallback:          "Sign-in failed during the provider callback. Please try again.",
  OAuthSignin:            "Could not start the sign-in flow. Please try again.",
};

// ─── OAuth provider icons ─────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 flex-shrink-0" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface LoginFormProps {
  /** Passed from the server component — true when RESEND_API_KEY + EMAIL_FROM are set. */
  magicLinkEnabled?: boolean;
}

export function LoginForm({ magicLinkEnabled = true }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const { success: toastSuccess, error: toastError } = useToastStore();

  const [tab, setTab] = useState<Tab>("password");
  const [pwLoading, setPwLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // 2FA challenge state — set when login returns requires2FA
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpError, setTotpError] = useState<string | null>(null);

  // Magic link state machine
  const [magicState, setMagicState] = useState<MagicState>(
    magicLinkEnabled ? "idle" : "provider_unavailable"
  );
  const [magicEmail, setMagicEmail] = useState("");

  const errorParam = searchParams.get("error");
  const errorMsg = errorParam ? (OAUTH_ERRORS[errorParam] ?? "Sign-in failed. Please try again.") : null;

  // Magic-link and OAuth 2FA: the verify/callback routes redirect here with a
  // pending token when the account has TOTP enabled. Enter the TOTP panel directly.
  useEffect(() => {
    const magic2fa  = searchParams.get("magic_2fa");
    const oauth2fa  = searchParams.get("oauth_2fa");
    const token2fa  = magic2fa ?? oauth2fa;
    if (token2fa && !pendingToken) {
      setPendingToken(token2fa);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redirect target after successful login
  const redirectTo = validateRedirect(searchParams.get("redirect"));

  function handleLoginSuccess(session: import("@/types").Session) {
    setSession(session);
    toastSuccess("Signed in", session.user.name ? `Welcome back, ${session.user.name}.` : "Welcome back.");
    router.push(redirectTo);
  }

  // ── Password login ─────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const identifier = String(form.get("identity") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!identifier || !password) return;

    setPwLoading(true);
    try {
      const result = await authService.signIn({ identifier, password });

      if ("requires2FA" in result) {
        // Password verified — 2FA challenge required before a session is issued
        setPendingToken(result.pendingToken);
        setTotpCode("");
        setTotpError(null);
        return;
      }

      handleLoginSuccess(result as import("@/types").Session);
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : "";
      if (code === "invalid_credentials") {
        toastError("Sign in failed", "Incorrect email or password.");
      } else if (code === "account_suspended") {
        toastError("Account suspended", "This account has been suspended. Contact support if you believe this is a mistake.");
      } else if (code === "db_unavailable") {
        toastError("Service unavailable", "Please try again in a moment.");
      } else {
        toastError("Sign in failed", "Something went wrong. Please try again.");
      }
    } finally {
      setPwLoading(false);
    }
  }

  // ── TOTP verification ──────────────────────────────────────────────────────
  async function handleTotpSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pendingToken || !totpCode.trim()) return;

    setTotpLoading(true);
    setTotpError(null);
    try {
      const session = await authService.verify2FA(pendingToken, totpCode.trim());
      handleLoginSuccess(session);
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : "";
      if (code === "invalid_code") {
        setTotpError("Invalid code. Check your authenticator app and try again.");
      } else if (code === "pending_token_expired" || code === "invalid_pending_token") {
        setTotpError("Your session expired. Please sign in again.");
        setPendingToken(null);
      } else if (code === "too_many_attempts") {
        setTotpError("Too many failed attempts. Please sign in again.");
        setPendingToken(null);
      } else if (code === "too_many_requests") {
        setTotpError("Too many requests. Please wait a moment and try again.");
      } else if (code === "account_suspended") {
        toastError("Account suspended", "This account has been suspended.");
        setPendingToken(null);
      } else {
        setTotpError("Something went wrong. Please try again.");
      }
    } finally {
      setTotpLoading(false);
    }
  }

  // ── Magic link ─────────────────────────────────────────────────────────────
  async function handleMagicLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const email = magicEmail.trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMagicState("invalid_email");
      return;
    }

    setMagicState("sending");
    try {
      await authService.sendMagicLink(email);
      setMagicState("sent");
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : "";
      if (code === "provider_unavailable") {
        setMagicState("provider_unavailable");
      } else if (code === "invalid_email") {
        setMagicState("invalid_email");
      } else {
        setMagicState("email_failed");
      }
    }
  }

  // ── OAuth ──────────────────────────────────────────────────────────────────
  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      await nextAuthSignIn("google", { callbackUrl: "/oauth-callback" });
    } finally {
      setGoogleLoading(false);
    }
  }

  // ── 2FA challenge panel ────────────────────────────────────────────────────

  if (pendingToken) {
    return (
      <div className="w-full space-y-[28px]">
        <div>
          <div className="flex items-center gap-[10px] mb-[6px]">
            <ShieldCheck className="size-5 text-[var(--purple-400)]" />
            <h1 className="text-[24px] font-bold tracking-tight text-[var(--text)]">Two-factor verification</h1>
          </div>
          <p className="t-body-sm text-[var(--muted)]">Enter the 6-digit code from your authenticator app, or use a backup code.</p>
        </div>

        <form className="space-y-[16px]" onSubmit={handleTotpSubmit}>
          <div>
            <Input
              name="code"
              label="Authentication code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              value={totpCode}
              onChange={(e) => {
                setTotpCode(e.target.value);
                if (totpError) setTotpError(null);
              }}
              autoFocus
              required
            />
            {totpError && (
              <p className="mt-[5px] t-caption text-[var(--danger)]">{totpError}</p>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            loading={totpLoading}
            disabled={totpLoading || !totpCode.trim()}
          >
            Verify
          </Button>
        </form>

        <button
          onClick={() => { setPendingToken(null); setTotpCode(""); setTotpError(null); }}
          className="w-full t-caption text-[var(--muted)] hover:text-[var(--text-soft)] transition-colors"
        >
          ← Back to sign in
        </button>
      </div>
    );
  }

  // ── Magic link panel ───────────────────────────────────────────────────────

  function renderMagicPanel() {
    if (magicState === "provider_unavailable") {
      return (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] px-[16px] py-[18px] space-y-[10px]">
          <div className="flex items-center gap-[8px]">
            <WifiOff className="size-4 text-[var(--text-muted)] flex-shrink-0" />
            <p className="t-label text-[var(--text)]">Magic link unavailable</p>
          </div>
          <p className="t-caption text-[var(--text-soft)]">
            Email sign-in is not configured for this deployment.
            Use your password or continue with Google instead.
          </p>
          {process.env.NODE_ENV === "development" && (
            <p className="t-caption text-[var(--text-muted)] bg-[var(--panel-2)] rounded-[var(--radius-md)] px-[10px] py-[8px] font-mono text-[11px]">
              Set <strong>RESEND_API_KEY</strong> and <strong>EMAIL_FROM</strong> in .env.local to enable.
            </p>
          )}
        </div>
      );
    }

    if (magicState === "sent") {
      return (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] px-[16px] py-[20px] text-center space-y-[8px]">
          <CheckCircle2 className="size-6 text-[var(--success)] mx-auto" />
          <p className="t-label text-[var(--text)]">Check your inbox</p>
          <p className="t-caption">
            A sign-in link was sent to <strong className="text-[var(--text-soft)]">{magicEmail}</strong>.
            It expires in 15 minutes.
          </p>
          <p className="t-caption text-[var(--text-muted)]">Check your spam folder if it doesn&apos;t arrive.</p>
          <button
            onClick={() => { setMagicState("idle"); setMagicEmail(""); }}
            className="t-caption text-[var(--text-muted)] hover:text-[var(--text-soft)] transition-colors underline underline-offset-2"
          >
            Use a different email
          </button>
        </div>
      );
    }

    const isExpiredFromUrl = errorParam === "link_expired";
    const isInvalidFromUrl = errorParam === "invalid_link";

    return (
      <form className="space-y-[14px]" onSubmit={handleMagicLink}>
        {isExpiredFromUrl && (
          <div className="flex items-start gap-[8px] rounded-[var(--radius-md)] border border-[rgba(234,179,8,0.2)] bg-[rgba(234,179,8,0.06)] px-[12px] py-[10px]">
            <Clock className="size-4 text-[var(--warning)] flex-shrink-0 mt-[1px]" />
            <p className="t-caption text-[var(--text-soft)]">
              That link expired. Enter your email to get a fresh one.
            </p>
          </div>
        )}
        {isInvalidFromUrl && !isExpiredFromUrl && (
          <div className="flex items-start gap-[8px] rounded-[var(--radius-md)] border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.06)] px-[12px] py-[10px]">
            <AlertCircle className="size-4 text-[var(--danger)] flex-shrink-0 mt-[1px]" />
            <p className="t-caption text-[var(--text-soft)]">
              That sign-in link is invalid or was already used. Request a new one.
            </p>
          </div>
        )}

        <div>
          <Input
            name="email"
            label="Email address"
            type="email"
            value={magicEmail}
            onChange={(e) => {
              setMagicEmail(e.target.value);
              if (magicState === "invalid_email" || magicState === "email_failed") {
                setMagicState("idle");
              }
            }}
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus={isExpiredFromUrl || isInvalidFromUrl}
            required
          />
          {magicState === "invalid_email" && (
            <p className="mt-[5px] t-caption text-[var(--danger)]">Enter a valid email address.</p>
          )}
          {magicState === "email_failed" && (
            <p className="mt-[5px] t-caption text-[var(--danger)]">
              Failed to send the email. Please try again.
            </p>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          loading={magicState === "sending"}
          disabled={magicState === "sending"}
        >
          {magicState === "sending" ? (
            "Sending…"
          ) : (
            <>
              <Mail className="size-3.5 mr-[6px]" />
              Send sign-in link
            </>
          )}
        </Button>
      </form>
    );
  }

  // ── Full render ────────────────────────────────────────────────────────────

  return (
    <div className="w-full space-y-[28px]">
      {/* Heading */}
      <div>
        <h1 className="text-[24px] font-bold tracking-tight text-[var(--text)]">Welcome back</h1>
        <p className="t-body-sm text-[var(--muted)] mt-[4px]">Sign in to your account</p>
        {errorMsg && !errorParam?.startsWith("link") && (
          <p className="mt-[10px] t-caption text-[var(--danger)] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.18)] rounded-[var(--radius-md)] px-[12px] py-[8px]">
            {errorMsg}
          </p>
        )}
      </div>

      {/* OAuth buttons */}
      <div className="flex flex-col gap-[8px]">
        <Button variant="secondary" size="md" className="w-full" loading={googleLoading} onClick={handleGoogle}>
          <GoogleIcon />
          Continue with Google
        </Button>
      </div>

      <Separator label="or" />

      {/* Tab switcher */}
      <div className="flex gap-[4px] rounded-[var(--radius-lg)] bg-[var(--panel-2)] p-[3px]">
        {(["password", "magic"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              if (t === "magic" && magicState === "sent") {
                setMagicState("idle");
                setMagicEmail("");
              }
            }}
            className={cn(
              "flex-1 py-[7px] rounded-[var(--radius-md)] t-label transition-colors",
              tab === t
                ? "bg-[var(--panel)] text-[var(--text)] shadow-[var(--shadow-sm)]"
                : "text-[var(--text-soft)] hover:text-[var(--text)]"
            )}
          >
            {t === "password" ? "Password" : "Magic link"}
          </button>
        ))}
      </div>

      {/* Password form */}
      {tab === "password" && (
        <form className="space-y-[16px]" onSubmit={handleSubmit}>
          <Input
            name="identity"
            label="Email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <div>
            <Input
              name="password"
              label="Password"
              type="password"
              placeholder="Your password"
              autoComplete="current-password"
              required
            />
            <div className="flex justify-end mt-[6px]">
              <Link
                href="/forgot-password"
                className="t-caption text-[var(--muted)] hover:text-[var(--text-soft)] transition-colors"
              >
                Forgot password?
              </Link>
            </div>
          </div>
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={pwLoading}>
            Log in
          </Button>
        </form>
      )}

      {/* Magic link panel */}
      {tab === "magic" && renderMagicPanel()}

      <p className="t-caption text-center text-[var(--muted)]">
        No account?{" "}
        <Link href="/register" className="text-[var(--text-soft)] hover:text-[var(--text)] transition-colors font-medium underline underline-offset-2">
          Sign up free
        </Link>
      </p>
    </div>
  );
}
