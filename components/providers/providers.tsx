"use client";

import { useEffect, type ReactNode } from "react";
import { useAuthStore } from "@/store/auth";
import { ModalProvider } from "./modal-provider";

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Rehydrates client auth state on boot.
 *
 * Two sources, in order:
 *   1. localStorage (zustand persist) — instant, may be stale.
 *   2. The server (`/api/auth/session`) — authoritative. This is what makes an
 *      httpOnly `session_token` cookie (set by email/password login AND by the
 *      OAuth bridge) visible to the client. Without this step a perfectly valid
 *      server session renders as logged-out, which is what made Google login
 *      look like it "didn't persist".
 */
export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    let cancelled = false;

    useAuthStore.persist.rehydrate();

    (async () => {
      const stored = useAuthStore.getState().session;
      try {
        const res = await fetch("/api/auth/session", {
          cache: "no-store",
          ...(stored?.token ? { headers: { authorization: `Bearer ${stored.token}` } } : {}),
        });
        if (cancelled) return;

        if (res.ok) {
          const data = (await res.json()) as { user: import("@/types").User; token?: string };
          useAuthStore.getState().setSession({
            user: data.user,
            token: data.token ?? stored?.token ?? "",
            expiresAt: stored?.expiresAt ?? new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString(),
          });
        } else if (res.status === 401) {
          // No valid server session — drop any stale persisted state.
          useAuthStore.getState().signOut();
        }
      } catch {
        // Offline / transient: keep whatever was persisted rather than logging out.
      } finally {
        if (!cancelled) useAuthStore.setState({ isLoading: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {children}
      <ModalProvider />
    </>
  );
}
