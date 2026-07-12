"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { authService } from "@/lib/services/auth.service";
import { Suspense } from "react";

/**
 * Auth bridge page — NextAuth redirects here after Google OAuth completes.
 * Reads the custom DB token from the NextAuth JWT via /api/auth/google-token
 * and hydrates the Zustand auth store, then sends the user to /dashboard.
 */
function OAuthCallbackInner() {
  const router = useRouter();

  useEffect(() => {
    async function bridge() {
      try {
        const tokenRes = await fetch("/api/auth/google-token");
        if (tokenRes.status === 403) {
          router.replace("/login?error=account_suspended");
          return;
        }
        if (!tokenRes.ok) {
          const errBody = await tokenRes.json().catch(() => ({})) as { error?: string; detail?: string };
          console.error("[oauth-callback] google-token failed:", tokenRes.status, errBody);
          throw new Error(errBody.error ?? "no_custom_token");
        }
        const data = (await tokenRes.json()) as { token?: string; isNewUser?: boolean };

        if (!data.token) throw new Error("no_custom_token");

        const session = await authService.validateSession(data.token);
        if (!session) throw new Error("invalid_session");

        useAuthStore.getState().setSession(session);
        useAuthStore.getState().setLoading(false);
        router.replace("/dashboard");
      } catch {
        router.replace("/login?error=oauth_failed");
      }
    }

    bridge();
  }, [router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="stack-sm text-center">
        <div className="mx-auto size-7 animate-spin rounded-full border-2 border-[var(--text-soft)] border-t-transparent" />
        <p className="t-body-sm text-[var(--text-soft)]">Signing you in…</p>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="mx-auto size-7 animate-spin rounded-full border-2 border-[var(--text-soft)] border-t-transparent" />
      </div>
    }>
      <OAuthCallbackInner />
    </Suspense>
  );
}
