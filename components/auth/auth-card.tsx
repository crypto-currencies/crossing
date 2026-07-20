"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44a5.5 5.5 0 0 1-2.39 3.62v3h3.86c2.26-2.09 3.58-5.17 3.58-8.86Z"
      />
      <path
        fill="currentColor"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path fill="currentColor" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.63H1.29a12 12 0 0 0 0 10.74l3.98-3.09Z" />
      <path
        fill="currentColor"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.63l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function AuthCard({ mode }: { mode: Mode }) {
  const router = useRouter();
  const isLogin = mode === "login";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex rounded-full border border-[var(--border-default)] bg-[var(--surface-raised)] p-1">
        <button
          type="button"
          onClick={() => router.push(ROUTES.auth.login)}
          className={cn(
            "flex-1 rounded-full py-2 text-sm font-medium transition-colors duration-150",
            isLogin ? "bg-sky-500 text-black-950" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          )}
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => router.push(ROUTES.auth.register)}
          className={cn(
            "flex-1 rounded-full py-2 text-sm font-medium transition-colors duration-150",
            !isLogin ? "bg-sky-500 text-black-950" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          )}
        >
          Sign up
        </button>
      </div>

      <h1 className="t-heading">{isLogin ? "Welcome back" : "Create your account"}</h1>
      <p className="t-body-sm mt-1.5 text-[var(--text-secondary)]">
        {isLogin ? "Log in to save and submit listings." : "It takes less than a minute."}
      </p>

      <Button variant="outline" className="mt-6 w-full" iconLeft={<GoogleIcon />}>
        Continue with Google
      </Button>

      <div className="my-6 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="t-caption">or</span>
        <Separator className="flex-1" />
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {!isLogin && <Input type="text" name="name" placeholder="Full name" autoComplete="name" required />}
        <Input type="email" name="email" placeholder="Email" autoComplete="email" required />
        <Input
          type="password"
          name="password"
          placeholder="Password"
          autoComplete={isLogin ? "current-password" : "new-password"}
          required
        />

        {isLogin && (
          <Link href={ROUTES.auth.forgotPassword} className="t-caption self-end text-sky-500 hover:text-sky-400">
            Forgot password?
          </Link>
        )}

        <Button type="submit" variant="primary" className="mt-2 w-full">
          {isLogin ? "Log in" : "Create account"}
        </Button>
      </form>

      {!isLogin && (
        <p className="t-caption mt-5 text-center">
          By signing up, you agree to our{" "}
          <Link href={ROUTES.legal.terms} className="text-sky-500 hover:text-sky-400">
            Terms
          </Link>{" "}
          and{" "}
          <Link href={ROUTES.legal.privacy} className="text-sky-500 hover:text-sky-400">
            Privacy Policy
          </Link>
          .
        </p>
      )}
    </div>
  );
}
