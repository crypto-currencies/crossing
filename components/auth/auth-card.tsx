"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Check, Compass, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ROUTES } from "@/lib/routes";
import { googleSignInArgs } from "@/lib/auth-google";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import type { Session } from "@/types";

type Mode = "login" | "signup";
type Intent = "consumer" | "business";

const IS_DEV = process.env.NODE_ENV !== "production";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44a5.5 5.5 0 0 1-2.39 3.62v3h3.86c2.26-2.09 3.58-5.17 3.58-8.86Z" />
      <path fill="currentColor" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z" />
      <path fill="currentColor" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.63H1.29a12 12 0 0 0 0 10.74l3.98-3.09Z" />
      <path fill="currentColor" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.63l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  );
}

export function AuthCard({
  mode,
  googleConfigured = true,
  redirectPath = "/dashboard",
  intent = "consumer",
}: {
  mode: Mode;
  googleConfigured?: boolean;
  redirectPath?: string;
  intent?: Intent;
}) {
  const router = useRouter();
  const isLogin = mode === "login";
  const isBusiness = intent === "business";
  const [googleLoading, setGoogleLoading] = useState(false);
  const [credentialLoading, setCredentialLoading] = useState(false);
  const [error, setError] = useState("");

  async function onGoogle() {
    if (!googleConfigured || googleLoading) return;
    const { provider, options } = googleSignInArgs(redirectPath);
    setError("");
    setGoogleLoading(true);
    try {
      const result = await signIn(provider, options);
      if (result?.error) {
        setError("Google sign-in failed. Please try again.");
        setGoogleLoading(false);
      }
    } catch {
      setError("Couldn’t start Google sign-in. Please try again.");
      setGoogleLoading(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (credentialLoading) return;
    setCredentialLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim();

    try {
      const response = await fetch(isLogin ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(isLogin ? { identifier: email, password } : { name, email, password }),
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<Session> & { error?: string };
      if (!response.ok || !payload.user || !payload.token || !payload.expiresAt) {
        throw new Error(authErrorCopy(payload.error, response.status));
      }
      useAuthStore.getState().setSession({
        user: payload.user,
        token: payload.token,
        expiresAt: payload.expiresAt,
      });
      router.replace(redirectPath);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed. Please try again.");
      setCredentialLoading(false);
    }
  }

  const intentQuery = `intent=${intent}`;
  const redirectQuery = redirectPath !== "/" ? `&redirect=${encodeURIComponent(redirectPath)}` : "";

  return (
    <div className="auth-card">
      <div className="auth-intent-switch" aria-label="Account intent">
        <Link href={`${isLogin ? ROUTES.auth.login : ROUTES.auth.register}?intent=consumer${redirectQuery}`} aria-current={!isBusiness ? "page" : undefined}>
          <Compass size={15} aria-hidden /> I’m here to discover
        </Link>
        <Link href={`${isLogin ? ROUTES.auth.login : ROUTES.auth.register}?intent=business${redirectQuery}`} aria-current={isBusiness ? "page" : undefined}>
          <BriefcaseBusiness size={15} aria-hidden /> I represent a business
        </Link>
      </div>

      <div className="auth-mode-switch" aria-label="Authentication mode">
        <button type="button" onClick={() => router.push(`${ROUTES.auth.login}?${intentQuery}${redirectQuery}`)} className={cn(isLogin && "active")}>
          Log in
        </button>
        <button type="button" onClick={() => router.push(`${ROUTES.auth.register}?${intentQuery}${redirectQuery}`)} className={cn(!isLogin && "active")}>
          Sign up
        </button>
      </div>

      <p className="product-eyebrow">{isBusiness ? "Business access" : "Crossing account"}</p>
      <h1>{isLogin ? "Welcome back" : isBusiness ? "Create a business entry account" : "Keep the good options close"}</h1>
      <p className="auth-card-intro">
        {isLogin
          ? `Log in to continue${redirectPath !== "/" ? " where you left off" : ""}.`
          : isBusiness
            ? "Use the shared identity system now. Business claims and permissions become available only after verification is implemented."
            : "Create an account to save confirmed listings and track contributions supported by the current product."}
      </p>

      <Button
        type="button"
        variant="outline"
        className="auth-provider-button"
        iconLeft={<GoogleIcon />}
        onClick={onGoogle}
        disabled={!googleConfigured || googleLoading}
        aria-label="Continue with Google"
      >
        {googleLoading ? "Redirecting to Google…" : "Continue with Google"}
      </Button>

      {!googleConfigured && IS_DEV ? (
        <p className="auth-provider-note">Google sign-in is not configured in this development environment.</p>
      ) : null}

      <div className="auth-separator">
        <Separator className="flex-1" />
        <span>or use email</span>
        <Separator className="flex-1" />
      </div>

      <form onSubmit={onSubmit} className="auth-form">
        {!isLogin ? (
          <label>
            <span>Name</span>
            <Input type="text" name="name" autoComplete="name" required />
          </label>
        ) : null}
        <label>
          <span>Email</span>
          <Input type="email" name="email" autoComplete="email" required />
        </label>
        <label>
          <span>Password</span>
          <Input type="password" name="password" autoComplete={isLogin ? "current-password" : "new-password"} minLength={isLogin ? undefined : 8} required />
          {!isLogin ? <small>At least 8 characters.</small> : null}
        </label>

        {isLogin ? (
          <Link href={ROUTES.auth.forgotPassword} className="auth-forgot">Forgot password?</Link>
        ) : null}

        {error ? <p role="alert" className="auth-error">{error}</p> : null}

        <Button type="submit" variant="primary" className="auth-submit" disabled={credentialLoading}>
          {credentialLoading
            ? <><LoaderCircle className="spin" size={16} aria-hidden /> Working…</>
            : <>{isLogin ? "Log in" : "Create account"} <ArrowRight size={16} aria-hidden /></>}
        </Button>
      </form>

      {!isLogin ? (
        <p className="auth-terms">
          By signing up, you agree to the <Link href={ROUTES.legal.terms}>Terms</Link> and <Link href={ROUTES.legal.privacy}>Privacy Policy</Link>.
        </p>
      ) : null}

      <div className="auth-benefits" aria-label="Account benefits">
        {(isBusiness
          ? ["Shared identity for future listing claims", "Clear separation from regular recommendations", "No business access until verification"]
          : ["Return to confirmed saved listings", "Track listing submissions", "Keep account activity in one place"]
        ).map((benefit) => <span key={benefit}><Check size={13} aria-hidden /> {benefit}</span>)}
      </div>
    </div>
  );
}

function authErrorCopy(code: string | undefined, status: number) {
  if (code === "invalid_credentials") return "The email or password is incorrect.";
  if (code === "credential_taken") return "An account already uses that email. Try logging in.";
  if (code === "password_too_short") return "Use at least 8 characters for your password.";
  if (code === "invalid_email") return "Enter a valid email address.";
  if (code === "account_suspended") return "This account is suspended. Contact support for help.";
  if (code === "db_unavailable" || status === 503) return "Account access is unavailable in this environment.";
  if (status === 429) return "Too many attempts. Wait a moment and try again.";
  return "Crossing could not complete that request. Please try again.";
}
