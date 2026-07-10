"use client";

/**
 * useStepUp — client-side step-up verification session management.
 *
 * Maintains a local cache of the verified session expiry so the admin can
 * perform multiple sensitive actions within a 10-minute window without being
 * prompted again. The cache is backed by sessionStorage, so it survives page
 * navigations within the same browser tab but is cleared when the tab closes.
 *
 * The server ALWAYS re-validates on every sensitive API call — the local cache
 * only controls whether to show the modal. If the server rejects with
 * "step_up_required", the action's error handler should clear the local cache
 * and prompt re-verification.
 *
 * Usage:
 *   const { withStepUp, StepUpGate, clearSession } = useStepUp();
 *
 *   // Wrap any sensitive action:
 *   <Button onClick={() => withStepUp(() => doSensitiveAction())}>
 *     Suspend
 *   </Button>
 *
 *   // Render the modal (returns null when not active):
 *   {StepUpGate}
 */

import { useState, useRef, useCallback, useEffect, createElement } from "react";
import { StepUpModal } from "@/components/admin/step-up-modal";

const SESSION_KEY = "admin_step_up_expiry";

function readLocalExpiry(): number | null {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    const n = parseInt(stored, 10);
    return Number.isFinite(n) && n > Date.now() ? n : null;
  } catch {
    return null;
  }
}

function writeLocalExpiry(expiry: number): void {
  try { sessionStorage.setItem(SESSION_KEY, String(expiry)); } catch { /* ignore */ }
}

function clearLocalExpiry(): void {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

export function useStepUp() {
  const [localExpiry, setLocalExpiry] = useState<number | null>(null);
  const [open, setOpen]               = useState(false);
  const pendingRef = useRef<(() => void) | null>(null);

  // Hydrate from sessionStorage on mount
  useEffect(() => {
    const cached = readLocalExpiry();
    if (cached) setLocalExpiry(cached);
  }, []);

  const isLocallyVerified = localExpiry !== null && Date.now() < localExpiry;

  // Called by the modal when verification succeeds
  const onVerified = useCallback((expiresAt: string) => {
    const expiry = new Date(expiresAt).getTime();
    setLocalExpiry(expiry);
    writeLocalExpiry(expiry);
    setOpen(false);
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) pending();
  }, []);

  const onClose = useCallback(() => {
    setOpen(false);
    pendingRef.current = null;
  }, []);

  /**
   * Execute `fn` immediately if the admin is locally verified,
   * otherwise open the step-up modal and execute `fn` after success.
   *
   * `fn` may be sync or async — useStepUp doesn't await it.
   */
  const withStepUp = useCallback((fn: () => void) => {
    if (isLocallyVerified) {
      fn();
      return;
    }
    pendingRef.current = fn;
    setOpen(true);
  }, [isLocallyVerified]);

  /**
   * Call this when a sensitive API responds with error:"step_up_required"
   * (e.g. local cache was stale). Clears the cache and opens the modal,
   * queuing the same action to retry after re-verification.
   */
  const handleStepUpRequired = useCallback((fn: () => void) => {
    setLocalExpiry(null);
    clearLocalExpiry();
    pendingRef.current = fn;
    setOpen(true);
  }, []);

  /**
   * Manually invalidate the local session (e.g., on sign-out).
   */
  const clearSession = useCallback(() => {
    setLocalExpiry(null);
    clearLocalExpiry();
  }, []);

  // Computed seconds remaining for display
  const secondsLeft = localExpiry !== null
    ? Math.max(0, Math.floor((localExpiry - Date.now()) / 1000))
    : 0;

  const StepUpGate = open
    ? createElement(StepUpModal, { onVerified, onClose })
    : null;

  return {
    withStepUp,
    handleStepUpRequired,
    clearSession,
    isVerified: isLocallyVerified,
    secondsLeft,
    StepUpGate,
  };
}
