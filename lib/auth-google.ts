/**
 * Google OAuth client helpers (framework-agnostic, unit-testable).
 *
 * The actual sign-in call uses next-auth/react's `signIn(GOOGLE_PROVIDER_ID, …)`
 * in the client component; these helpers build the validated callback URL so the
 * requested post-login redirect is preserved through the OAuth round-trip.
 */

import { safeInternalPath } from "./auth-redirect";

/** NextAuth provider id — must match the GoogleProvider registration. */
export const GOOGLE_PROVIDER_ID = "google";

/** The bridge page that exchanges the OAuth session for a DB session. */
export const OAUTH_CALLBACK_PATH = "/oauth-callback";

/**
 * Build the NextAuth `callbackUrl` for a Google sign-in. NextAuth returns here
 * after Google auth; the bridge page then honors the (validated) `redirect`.
 */
export function googleCallbackUrl(redirectPath: string | null | undefined): string {
  const safe = safeInternalPath(redirectPath, "/");
  return `${OAUTH_CALLBACK_PATH}?redirect=${encodeURIComponent(safe)}`;
}

/**
 * The exact arguments passed to next-auth/react `signIn(...)`. Extracted so the
 * provider id + preserved redirect can be unit-tested without a DOM.
 */
export function googleSignInArgs(redirectPath: string | null | undefined): {
  provider: typeof GOOGLE_PROVIDER_ID;
  options: { callbackUrl: string };
} {
  return { provider: GOOGLE_PROVIDER_ID, options: { callbackUrl: googleCallbackUrl(redirectPath) } };
}

/** True when both Google OAuth credentials are configured (server-side check). */
export function isGoogleConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const id = env.GOOGLE_CLIENT_ID?.trim();
  const secret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (!id || !secret) return false;
  // Reject the .env.example placeholders so a half-configured env disables the button.
  if (id === "your-google-client-id" || secret === "your-google-client-secret") return false;
  return true;
}
