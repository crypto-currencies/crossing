/**
 * Safe handling of user-supplied redirect targets (?redirect= / ?next= params).
 *
 * Only same-origin relative paths are ever allowed. Everything else —
 * absolute URLs, protocol-relative URLs, javascript:/data: schemes — falls
 * back to the provided default. Shared by client and server code.
 */

const DEFAULT_REDIRECT = "/dashboard";

/**
 * Returns `target` if it is a safe same-origin relative path, otherwise `fallback`.
 *
 * Allowed:  "/dashboard", "/settings?tab=privacy", "/profiles/abc#top"
 * Denied:   "https://evil.com", "//evil.com", "javascript:alert(1)",
 *           "data:text/html,...", "/\evil.com", anything containing "://"
 */
export function validateRedirect(
  target: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT
): string {
  if (!target) return fallback;

  // Must be a relative path: exactly one leading slash.
  // "//evil.com" is protocol-relative; "/\evil.com" is normalized to it by browsers.
  if (!target.startsWith("/")) return fallback;
  if (target.startsWith("//") || target.startsWith("/\\")) return fallback;

  // No scheme separators anywhere — blocks "/foo://", encoded tricks resolve
  // to paths that still start with "/" so they stay same-origin regardless.
  if (target.includes("://")) return fallback;

  // Defense in depth against javascript:/data: smuggled after path characters.
  const lower = target.toLowerCase();
  if (lower.includes("javascript:") || lower.includes("data:")) return fallback;

  return target;
}
