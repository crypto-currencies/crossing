"use client";

import { useState } from "react";
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

// ─── URL error codes from OAuth callback redirects ────────────────────────────

const OAUTH_ERRORS: Record<string, string> = {
  oauth_failed:           "Sign-in failed. Please try again.",
  invalid_session:        "Your session was invalid. Please sign in again.",
  db_unavailable:         "Service temporarily unavailable. Please try again shortly.",
  user_create_failed:     "Could not create your account. Please try again.",
  account_suspended:      "This account has been suspended. Contact support if you believe this is a mistake.",
  // Provider-level rejections (error code appears in the URL)
  invalid_oauth2_token:   "Sign-in was rejected by the provider. Please try again.",
  redirect_uri_mismatch:  "Sign-in configuration error. Please contact support.",
  OAuthCallback:          "Sign-in failed during the provider callback. Please try again.",
  OAuthSignin:            "Could not start the sign-in flow. Please try again.",
};

// ─── OAuth provider icon ──────────────────────────────────────────────────────

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

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const { success: toastSuccess, error: toastError } = useToastStore();

  const [pwLoading, setPwLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const errorParam = searchParams.get("error");
  const errorMsg = errorParam ? (OAUTH_ERRORS[errorParam] ?? "Sign-in failed. Please try again.") : null;

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
      const session = await authService.signIn({ identifier, password });
      handleLoginSuccess(session);
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

  // ── OAuth ──────────────────────────────────────────────────────────────────
  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      await nextAuthSignIn("google", { callbackUrl: "/oauth-callback" });
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="w-full space-y-[28px]">
      {/* Heading */}
      <div>
        <h1 className="text-[24px] font-bold tracking-tight text-[var(--text)]">Welcome back</h1>
        <p className="t-body-sm text-[var(--muted)] mt-[4px]">Sign in to your account</p>
        {errorMsg && (
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

      {/* Password form */}
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

      <p className="t-caption text-center text-[var(--muted)]">
        No account?{" "}
        <Link href="/register" className="text-[var(--text-soft)] hover:text-[var(--text)] transition-colors font-medium underline underline-offset-2">
          Sign up free
        </Link>
      </p>
    </div>
  );
}
