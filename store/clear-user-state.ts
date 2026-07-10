"use client";

/**
 * Clears all user-specific Zustand stores.
 *
 * Call this BEFORE useAuthStore.signOut() on every logout path:
 *   - explicit sign-out button (product-modals.tsx)
 *   - stale/invalid token detected at bootstrap (providers.tsx)
 *   - forced sign-out from another device
 *
 * This prevents cross-account data leakage when the same browser
 * session is reused for a different account.
 */

import { useNotificationsStore } from "./notifications";

export function clearAllUserState(): void {
  useNotificationsStore.getState().clear();
}
