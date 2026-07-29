// Set the owner email BEFORE importing admin.ts (it captures OWNER_EMAIL at load).
process.env.OWNER_EMAIL = "owner@example.com";

import { test } from "node:test";
import assert from "node:assert/strict";
import { isAdmin, isOwner } from "./auth";

// ─── Role gate used by /control/admin/evidence ────────────────────────────────

test("access — a non-owner (USER) is denied admin access", () => {
  assert.equal(isAdmin({ role: "USER" }), false);
  assert.equal(isAdmin({}), false); // no role → USER → denied
});

test("access — ADMIN and OWNER pass the admin gate; only OWNER passes the owner gate", () => {
  assert.equal(isAdmin({ role: "ADMIN" }), true);
  assert.equal(isAdmin({ role: "OWNER" }), true);
  assert.equal(isOwner({ role: "OWNER" }), true);
  assert.equal(isOwner({ role: "ADMIN" }), false);
});

// ─── Owner-email bootstrap match ──────────────────────────────────────────────

test("access — matchesOwnerCredentials matches the configured owner email (case-insensitive)", async () => {
  const { matchesOwnerCredentials } = await import("./admin");
  assert.equal(matchesOwnerCredentials({ email: "owner@example.com" }), true);
  assert.equal(matchesOwnerCredentials({ email: "OWNER@Example.com" }), true);
  assert.equal(matchesOwnerCredentials({ email: "someone@else.com" }), false);
  assert.equal(matchesOwnerCredentials({ email: null }), false);
  assert.equal(matchesOwnerCredentials({}), false);
});
