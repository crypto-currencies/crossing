import { test } from "node:test";
import assert from "node:assert/strict";
import { safeInternalPath, isProtectedPath } from "./auth-redirect";

// ─── safeInternalPath ─────────────────────────────────────────────────────────

test("safeInternalPath — preserves a safe internal path", () => {
  assert.equal(safeInternalPath("/control/admin/evidence"), "/control/admin/evidence");
  assert.equal(safeInternalPath("/dashboard?tab=1"), "/dashboard?tab=1");
});

test("safeInternalPath — rejects external and protocol-relative URLs", () => {
  assert.equal(safeInternalPath("https://evil.com"), "/");
  assert.equal(safeInternalPath("//evil.com/x"), "/");
  assert.equal(safeInternalPath("http://evil.com"), "/");
  assert.equal(safeInternalPath("/\\evil.com"), "/");
  assert.equal(safeInternalPath("/redirect://evil"), "/");
});

test("safeInternalPath — rejects non-paths, control chars, empty, and overlong", () => {
  assert.equal(safeInternalPath("evidence"), "/");
  assert.equal(safeInternalPath(""), "/");
  assert.equal(safeInternalPath(null), "/");
  assert.equal(safeInternalPath(undefined), "/");
  assert.equal(safeInternalPath("/a\nb"), "/");
  assert.equal(safeInternalPath("/" + "x".repeat(600)), "/");
});

test("safeInternalPath — honors a custom fallback", () => {
  assert.equal(safeInternalPath("https://evil.com", "/login"), "/login");
});

// ─── isProtectedPath (middleware) ────────────────────────────────────────────

test("isProtectedPath — /control and friends are protected", () => {
  assert.equal(isProtectedPath("/control/admin/evidence"), true);
  assert.equal(isProtectedPath("/control"), true);
  assert.equal(isProtectedPath("/dashboard"), true);
  assert.equal(isProtectedPath("/settings/security"), true);
});

test("isProtectedPath — /api/auth/* and /login are NOT protected (no block, no loop)", () => {
  assert.equal(isProtectedPath("/api/auth/callback/google"), false);
  assert.equal(isProtectedPath("/api/auth/signin/google"), false);
  assert.equal(isProtectedPath("/login"), false);
  assert.equal(isProtectedPath("/oauth-callback"), false);
  assert.equal(isProtectedPath("/"), false);
  // A look-alike prefix must not match.
  assert.equal(isProtectedPath("/controlpanel"), false);
});
