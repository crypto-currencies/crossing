import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasGlobalRole,
  hasBusinessRole,
  isPlatformModerator,
  canManageBusiness,
  wouldRemoveLastOwner,
  wouldDemoteLastOwner,
  normalizeEmail,
} from "./permissions";
import { isEnabled, allFlags, FEATURE_FLAGS } from "@/lib/server/feature-flags";

// ─── Two independent role axes ───────────────────────────────────────────────

test("identity — consumer and business capabilities coexist on one account", () => {
  // A plain consumer who happens to own a business is still a global USER.
  const ctx = { globalRole: "USER" as const, membershipRole: "OWNER" as const };
  assert.equal(canManageBusiness(ctx, "business:transfer_ownership").allowed, true);
  // ...but owning a business grants NO platform privilege.
  assert.equal(hasGlobalRole(ctx.globalRole, "MODERATOR"), false);
  assert.equal(hasGlobalRole(ctx.globalRole, "ADMIN"), false);
  assert.equal(isPlatformModerator(ctx.globalRole), false);
});

test("identity — global admin is not implicitly a business member, and is flagged when acting", () => {
  const admin = { globalRole: "ADMIN" as const, membershipRole: null };
  const decision = canManageBusiness(admin, "business:edit_profile");
  assert.equal(decision.allowed, true);
  assert.equal(decision.viaPlatformStaff, true, "must be distinguishable for audit logging");

  // Even a platform admin cannot delete someone else's business.
  assert.equal(canManageBusiness(admin, "business:delete").allowed, false);
});

test("business roles — capability ladder is enforced", () => {
  const editor = { globalRole: "USER" as const, membershipRole: "EDITOR" as const };
  assert.equal(canManageBusiness(editor, "business:edit_profile").allowed, true);
  assert.equal(canManageBusiness(editor, "business:submit_correction").allowed, true);
  assert.equal(canManageBusiness(editor, "business:invite_member").allowed, false);
  assert.equal(canManageBusiness(editor, "business:transfer_ownership").allowed, false);

  const bizAdmin = { globalRole: "USER" as const, membershipRole: "ADMIN" as const };
  assert.equal(canManageBusiness(bizAdmin, "business:invite_member").allowed, true);
  assert.equal(canManageBusiness(bizAdmin, "business:transfer_ownership").allowed, false);
});

test("business roles — ANALYST cannot manage billing, BILLING can", () => {
  const analyst = { globalRole: "USER" as const, membershipRole: "ANALYST" as const };
  const billing = { globalRole: "USER" as const, membershipRole: "BILLING" as const };
  assert.equal(canManageBusiness(analyst, "business:view_analytics").allowed, true);
  assert.equal(canManageBusiness(analyst, "business:manage_billing").allowed, false);
  assert.equal(canManageBusiness(billing, "business:manage_billing").allowed, true);
  // Neither may edit content.
  assert.equal(canManageBusiness(analyst, "business:edit_profile").allowed, false);
  assert.equal(canManageBusiness(billing, "business:edit_profile").allowed, false);
});

test("authorization — a non-member is denied and told nothing about the business", () => {
  const stranger = { globalRole: "USER" as const, membershipRole: null };
  const d = canManageBusiness(stranger, "business:view");
  assert.equal(d.allowed, false);
  assert.match(d.reason, /not a member/);
});

test("global roles — hierarchy is ordered", () => {
  assert.equal(hasGlobalRole("OWNER", "ADMIN"), true);
  assert.equal(hasGlobalRole("ADMIN", "MODERATOR"), true);
  assert.equal(hasGlobalRole("MODERATOR", "ADMIN"), false);
  assert.equal(hasGlobalRole(null, "USER"), false);
  assert.equal(hasBusinessRole("OWNER", "ADMIN"), true);
  assert.equal(hasBusinessRole("EDITOR", "ADMIN"), false);
});

// ─── Last-owner protection ───────────────────────────────────────────────────

test("last-owner protection — the sole owner cannot be removed or demoted", () => {
  const solo = [
    { userId: "u1", role: "OWNER" as const },
    { userId: "u2", role: "ADMIN" as const },
  ];
  assert.equal(wouldRemoveLastOwner(solo, "u1"), true);
  assert.equal(wouldRemoveLastOwner(solo, "u2"), false);
  assert.equal(wouldDemoteLastOwner(solo, "u1", "ADMIN"), true);
  // Re-affirming OWNER is a no-op, not a demotion.
  assert.equal(wouldDemoteLastOwner(solo, "u1", "OWNER"), false);
});

test("last-owner protection — a second owner unblocks removal", () => {
  const two = [
    { userId: "u1", role: "OWNER" as const },
    { userId: "u2", role: "OWNER" as const },
  ];
  assert.equal(wouldRemoveLastOwner(two, "u1"), false);
  assert.equal(wouldDemoteLastOwner(two, "u1", "EDITOR"), false);
});

test("email normalization is case- and whitespace-insensitive", () => {
  assert.equal(normalizeEmail("  Owner@Example.COM "), "owner@example.com");
});

// ─── Feature flags ───────────────────────────────────────────────────────────

test("feature flags — every flag defaults OFF", () => {
  const flags = allFlags({} as NodeJS.ProcessEnv);
  for (const f of FEATURE_FLAGS) assert.equal(flags[f], false, `${f} must default off`);
});

test("feature flags — only explicit opt-in values enable a surface", () => {
  const env = (v: string) => ({ NODE_ENV: "test", FEATURE_SAVED_ITEMS: v }) as NodeJS.ProcessEnv;
  for (const on of ["on", "true", "1"]) assert.equal(isEnabled("FEATURE_SAVED_ITEMS", env(on)), true);
  for (const off of ["off", "false", "0", "yes", ""]) assert.equal(isEnabled("FEATURE_SAVED_ITEMS", env(off)), false);
});
