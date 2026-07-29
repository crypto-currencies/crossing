/**
 * Post-login redirect safety + protected-route helpers.
 *
 * Shared by the middleware (proxy.ts), the login page, and the OAuth callback
 * bridge so "which paths are protected" and "is this redirect safe" are decided
 * in exactly one place. Pure + dependency-free → unit-testable.
 */

/** Route prefixes that require an authenticated session cookie. */
export const PROTECTED_PREFIXES = ["/dashboard", "/settings", "/notifications", "/control"] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** True if the string contains any ASCII control character (code < 0x20). */
function hasControlChars(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) < 0x20) return true;
  }
  return false;
}

/**
 * Validate a post-login `redirect` target. Only same-origin absolute paths are
 * allowed; anything that could escape the origin (external URL, protocol-relative
 * `//host`, backslash tricks, control chars, embedded scheme) falls back.
 */
export function safeInternalPath(raw: string | null | undefined, fallback = "/"): string {
  if (typeof raw !== "string") return fallback;
  const s = raw.trim();
  if (s === "") return fallback;
  if (!s.startsWith("/")) return fallback; // must be an absolute internal path
  if (s.startsWith("//")) return fallback; // protocol-relative → external host
  if (s.startsWith("/\\") || s.startsWith("/%5c") || s.startsWith("/%5C")) return fallback; // backslash tricks
  if (s.includes("://")) return fallback; // embedded scheme
  if (hasControlChars(s)) return fallback;
  if (s.length > 512) return fallback;
  return s;
}
