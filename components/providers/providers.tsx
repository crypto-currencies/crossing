"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/auth";
import { AnimatePresence } from "framer-motion";
import { useUIStore } from "@/store/ui";
import { ToastStack } from "@/components/ui/toast";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import { authService } from "@/lib/services/auth.service";
import { notificationService } from "@/lib/services/notification.service";
import { useNotificationsStore } from "@/store/notifications";
import { clearAllUserState } from "@/store/clear-user-state";
import { useLivePresence } from "@/hooks/use-live-presence";
import { CookieBanner } from "@/components/layout/cookie-banner";

interface ProvidersProps {
  children: React.ReactNode;
}

/** Fetches all user-specific data from the API and populates Zustand stores. */
function hydrateStores() {
  notificationService.list().then(({ items }) => {
    useNotificationsStore.getState().load(items);
  }).catch(() => {});
}

/** Lightweight poll: refresh notifications. */
async function pollUserData() {
  const uid = useAuthStore.getState().user?.id;
  if (!uid) return;
  await notificationService.list().then(({ items }) => {
    useNotificationsStore.getState().load(items);
  }).catch(() => {});
}

export function Providers({ children }: ProvidersProps) {
  useLivePresence();

  // Track the last userId we hydrated for — prevents re-hydration when
  // other auth store fields update (e.g. token rotation).
  const hydratedForRef = useRef<string | null>(null);

  // ── One-time bootstrap: validate stored session on app mount ─────────────
  useEffect(() => {
    useAuthStore.persist.rehydrate();

    async function bootstrap() {
      const { session } = useAuthStore.getState();

      // ── Step 1: clear time-expired locally-stored token ───────────────────
      const locallyExpired =
        session?.expiresAt &&
        session.expiresAt !== "" &&
        new Date(session.expiresAt) < new Date();
      if (locallyExpired) {
        clearAllUserState();
        useAuthStore.getState().signOut();
      }

      // ── Step 2: validate Bearer token if Zustand has one ─────────────────
      if (session?.token && !locallyExpired) {
        const validated = await authService.validateSession(session.token);

        if (validated?.dbUnavailable) {
          // DB temporarily down — preserve cached session; don't sign out
          useAuthStore.getState().setLoading(false);
          return;
        }

        if (validated && validated.user) {
          // Token is good — update store with fresh server data
          useAuthStore.getState().setSession(validated);
          useAuthStore.getState().setLoading(false);
          // hydrateStores is triggered by the userId-watcher effect below
          return;
        }

        // null → token was deleted or invalid (e.g. logout on another device)
        clearAllUserState();
        useAuthStore.getState().signOut();
      }

      // ── Step 3: cookie-based auth fallback ────────────────────────────────
      const me = await authService.fetchMe();

      if (me?.dbUnavailable) {
        useAuthStore.getState().setLoading(false);
        return;
      }

      if (me?.user) {
        useAuthStore.getState().setSession({
          token: "",
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          user: me.user,
        });
        useAuthStore.getState().setLoading(false);
        // hydrateStores triggered by userId-watcher below
        return;
      }

      // No valid auth found
      clearAllUserState();
      useAuthStore.getState().signOut();
      useAuthStore.getState().setLoading(false);
    }

    bootstrap();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reactive re-hydration: load stores whenever the authed user changes ──
  // This handles:
  //   (a) initial login via login page (same-session, no page reload)
  //   (b) account switch: user A logs out → user B logs in
  //   (c) initial bootstrap (bootstrap sets the session, triggering this)
  useEffect(() => {
    const unsub = useAuthStore.subscribe((state) => {
      const uid = state.user?.id ?? null;

      if (uid && uid !== hydratedForRef.current) {
        // New authenticated user — clear any previous user's data first,
        // then load the new user's data.
        if (hydratedForRef.current !== null) {
          // Switching from a different user: show loading state during the swap
          useAuthStore.getState().setSwitchingAccount(true);
          clearAllUserState();
        }
        hydratedForRef.current = uid;
        hydrateStores();
        // Loading state clears automatically when setSession is called (setSwitchingAccount(false))
        // but as a safety net, always resolve after hydration settles
        setTimeout(() => useAuthStore.getState().setSwitchingAccount(false), 2000);
      } else if (!uid && hydratedForRef.current !== null) {
        // User signed out — clear stores
        hydratedForRef.current = null;
        clearAllUserState();
      }
    });

    // Also handle the case where auth state is already set at mount time
    // (e.g. SSR-rehydrated session that bypassed bootstrap)
    const { user } = useAuthStore.getState();
    if (user?.id && user.id !== hydratedForRef.current) {
      hydratedForRef.current = user.id;
      hydrateStores();
    }

    return unsub;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Background poll: keep notifications fresh ───────────────────────────────
  // Runs every 60s. Pauses automatically when the tab is hidden to avoid
  // burning CPU/DB while the user isn't looking.
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (id) return;
      id = setInterval(pollUserData, 60_000);
    }
    function stop() {
      if (id) { clearInterval(id); id = null; }
    }

    // Pause when tab goes to background, resume on focus
    function handleVisibility() {
      if (document.visibilityState === "hidden") stop();
      else start();
    }

    start();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return (
    <>
      {children}
      <ModalLayer />
      <ToastStack />
      <NotificationPanel />
      <CookieBanner />
    </>
  );
}

function ModalLayer() {
  const modals = useUIStore((s) => s.modals);
  return (
    <AnimatePresence mode="sync">
      {modals.map((modal) => (
        <div key={modal.id}>{modal.component}</div>
      ))}
    </AnimatePresence>
  );
}
