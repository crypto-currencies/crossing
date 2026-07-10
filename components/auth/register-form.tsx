"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn as nextAuthSignIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/store/auth";
import { useToastStore } from "@/store/toast";
import { authService } from "@/lib/services/auth.service";

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

// ─── Error messages ───────────────────────────────────────────────────────────

function errorMessage(code: string): { title: string; body: string } {
  switch (code) {
    case "credential_taken":   return { title: "Already in use",     body: "That email is already registered. Try logging in." };
    case "invalid_email":      return { title: "Invalid email",      body: "Please enter a valid email address." };
    case "password_too_short": return { title: "Password too short", body: "Password must be at least 8 characters." };
    case "db_unavailable":     return { title: "Service unavailable", body: "Please try again in a moment." };
    default:                   return { title: "Registration failed", body: "Something went wrong. Please try again." };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RegisterForm() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const { success: toastSuccess, error: toastError } = useToastStore();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || !password) return;

    setLoading(true);
    try {
      const session = await authService.register({ name, email, password });
      setSession(session);
      toastSuccess(
        "Account created",
        `Welcome to Crossing.dev${session.user.name ? `, ${session.user.name}` : ""}!`
      );
      router.push("/dashboard");
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : "";
      const { title, body } = errorMessage(code);
      toastError(title, body);
    } finally {
      setLoading(false);
    }
  }

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
        <h1 className="text-[24px] font-bold tracking-tight text-[var(--text)]">Create your account</h1>
        <p className="t-body-sm text-[var(--muted)] mt-[4px]">Find the things worth your time.</p>
      </div>

      {/* OAuth buttons */}
      <div className="flex flex-col gap-[8px]">
        <Button variant="secondary" size="md" className="w-full" loading={googleLoading} onClick={handleGoogle}>
          <GoogleIcon />
          Continue with Google
        </Button>
      </div>

      <Separator label="or sign up with email" />

      {/* Registration form */}
      <form className="space-y-[16px]" onSubmit={handleSubmit}>
        <Input
          name="name"
          label="Name"
          type="text"
          placeholder="Your name"
          autoComplete="name"
        />
        <Input
          name="email"
          label="Email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        <Input
          name="password"
          label="Password"
          type="password"
          placeholder="Min. 8 characters"
          autoComplete="new-password"
          required
          minLength={8}
        />
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
          Create account
        </Button>
      </form>

      <p className="t-caption text-center text-[var(--muted)]">
        Already have an account?{" "}
        <Link href="/login" className="text-[var(--text-soft)] hover:text-[var(--text)] transition-colors font-medium underline underline-offset-2">
          Log in
        </Link>
      </p>

      <p className="t-caption text-center text-[var(--muted)]">
        By signing up you agree to our{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-[var(--text-soft)] transition-colors">Terms</Link>
        {" "}and{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-[var(--text-soft)] transition-colors">Privacy Policy</Link>.
      </p>
    </div>
  );
}
