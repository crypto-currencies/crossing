"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { useAuthStore } from "@/store/auth";
import { safeInternalPath } from "@/lib/auth-redirect";
import type { User } from "@/types";

const IS_DEV = process.env.NODE_ENV !== "production";
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * OAuth → DB-session bridge. NextAuth redirects here after Google auth. We
 * exchange the encrypted NextAuth JWT for a real DB session (which also sets the
 * httpOnly session cookie server components read), hydrate the client store, and
 * forward to the validated `redirect` target.
 */
export default function OAuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Read the redirect from the URL directly (avoids a Suspense boundary).
      const raw = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("redirect") : null;
      const target = safeInternalPath(raw, "/");
      if (IS_DEV) console.info("[auth] oauth-callback bridge start", { target });

      try {
        // 1. Mint the DB session (sets the httpOnly session cookie + returns token).
        const res = await fetch("/api/auth/google-token", { headers: { accept: "application/json" } });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          if (IS_DEV) console.error("[auth] google-token failed:", res.status, j.error);
          if (!cancelled) router.replace(`/login?error=${encodeURIComponent(j.error ?? "oauth_failed")}`);
          return;
        }
        const data = (await res.json()) as { token: string };

        // 2. Best-effort hydrate the client auth store (cookie already authorizes SSR).
        try {
          const s = await fetch("/api/auth/session", { headers: { authorization: `Bearer ${data.token}` } });
          if (s.ok) {
            const sj = (await s.json()) as { user: User };
            useAuthStore.getState().setSession({
              token: data.token,
              expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString(),
              user: sj.user,
            });
          }
        } catch {
          /* store hydration is non-critical — the cookie still authorizes the app */
        }

        if (IS_DEV) console.info("[auth] bridge complete → redirecting", { target });
        if (!cancelled) router.replace(target);
      } catch (e) {
        if (IS_DEV) console.error("[auth] bridge threw:", e);
        if (!cancelled) {
          setMessage("Sign-in couldn't be completed. Redirecting…");
          router.replace("/login?error=oauth_failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex flex-col items-center gap-4">
      <Spinner size={28} />
      <p className="t-body-sm text-[var(--text-secondary)]" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
