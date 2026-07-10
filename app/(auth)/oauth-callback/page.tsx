"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { authService } from "@/lib/services/auth.service";
import { validateRedirect } from "@/lib/redirect";
import { Suspense } from "react";

/**
 * Auth bridge page — used by two flows:
 *
 * 1. OAuth (Google): NextAuth redirects here after sign-in.
 *    Reads the custom DB token from the NextAuth JWT via /api/auth/google-token
 *    and hydrates the Zustand auth store.
 *
 * 2. Magic link: /api/auth/magic-link/verify redirects here with ?token=<session_token>.
 *    The token is read directly from the URL and hydrated into the store.
 *
 * Users are sent to /dashboard (or the ?redirect= path).
 */
function OAuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function bridge() {
      // ── Magic-link path ───────────────────────────────────────────────────
      const magic = searchParams.get("magic");
      if (magic === "1") {
        const session = await authService.validateSessionFromCookie();
        if (!session) {
          router.replace("/login?error=invalid_session");
          return;
        }
        useAuthStore.getState().setSession(session);
        useAuthStore.getState().setLoading(false);
        router.replace("/dashboard");
        return;
      }

      // ── Legacy direct token path (kept for backwards-compat) ─────────────
      const directToken = searchParams.get("token");
      if (directToken) {
        const session = await authService.validateSession(directToken);
        if (!session) {
          router.replace("/login?error=invalid_session");
          return;
        }
        useAuthStore.getState().setSession(session);
        useAuthStore.getState().setLoading(false);
        const redirect = validateRedirect(searchParams.get("redirect"));
        router.replace(redirect);
        return;
      }

      // ── OAuth path (Google) ───────────────────────────────────────────────
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
        const data = (await tokenRes.json()) as {
          token?: string;
          isNewUser?: boolean;
          requires2FA?: boolean;
          pendingToken?: string;
        };

        // Account has TOTP — redirect to login's 2FA panel with the pending token
        if (data.requires2FA && data.pendingToken) {
          const loginUrl = new URL("/login", window.location.href);
          loginUrl.searchParams.set("oauth_2fa", data.pendingToken);
          if (data.isNewUser) loginUrl.searchParams.set("new", "1");
          router.replace(loginUrl.pathname + loginUrl.search);
          return;
        }

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
  }, [router, searchParams]);

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
