/**
 * Authorization: two independent axes (backend plan §3).
 *
 *   GLOBAL   USER < MODERATOR < ADMIN < OWNER      → User.role
 *   BUSINESS ANALYST/BILLING < EDITOR < ADMIN < OWNER → BusinessMembership.role
 *
 * Hard rules enforced here:
 *   - Owning/administering a business NEVER widens global privilege.
 *   - A global admin may moderate a business but is not a member of it; such
 *     actions are flagged so callers can audit-log them.
 *   - No decision is ever made from a client-supplied role value — callers pass
 *     roles they read from the database.
 */

export type GlobalRole = "USER" | "MODERATOR" | "ADMIN" | "OWNER";
export type BusinessRole = "ANALYST" | "BILLING" | "EDITOR" | "ADMIN" | "OWNER";

const GLOBAL_RANK: Record<GlobalRole, number> = { USER: 0, MODERATOR: 1, ADMIN: 2, OWNER: 3 };
/** ANALYST and BILLING are peers: neither can edit; each sees a different slice. */
const BUSINESS_RANK: Record<BusinessRole, number> = { ANALYST: 0, BILLING: 0, EDITOR: 1, ADMIN: 2, OWNER: 3 };

export function hasGlobalRole(role: GlobalRole | null | undefined, min: GlobalRole): boolean {
  if (!role) return false;
  return (GLOBAL_RANK[role] ?? -1) >= GLOBAL_RANK[min];
}

export function hasBusinessRole(role: BusinessRole | null | undefined, min: BusinessRole): boolean {
  if (!role) return false;
  return (BUSINESS_RANK[role] ?? -1) >= BUSINESS_RANK[min];
}

/** Platform staff who may review moderation queues. */
export function isPlatformModerator(role: GlobalRole | null | undefined): boolean {
  return hasGlobalRole(role, "MODERATOR");
}

// ─── Business capabilities ────────────────────────────────────────────────────

export type BusinessCapability =
  | "business:view"
  | "business:edit_profile"
  | "business:submit_correction"
  | "business:view_analytics"
  | "business:manage_billing"
  | "business:invite_member"
  | "business:change_role"
  | "business:remove_member"
  | "business:manage_claim"
  | "business:transfer_ownership"
  | "business:delete";

const CAPABILITY_MIN_ROLE: Record<BusinessCapability, BusinessRole> = {
  "business:view": "ANALYST",
  "business:view_analytics": "ANALYST",
  "business:manage_billing": "BILLING",
  "business:edit_profile": "EDITOR",
  "business:submit_correction": "EDITOR",
  "business:invite_member": "ADMIN",
  "business:change_role": "ADMIN",
  "business:remove_member": "ADMIN",
  "business:manage_claim": "ADMIN",
  "business:transfer_ownership": "OWNER",
  "business:delete": "OWNER",
};

export interface AccessContext {
  /** The caller's global role, read fresh from the DB. */
  globalRole: GlobalRole | null | undefined;
  /** The caller's membership role in the business in question, or null. */
  membershipRole: BusinessRole | null | undefined;
}

export interface AccessDecision {
  allowed: boolean;
  /** True when access came from platform staff rather than membership. */
  viaPlatformStaff: boolean;
  reason: string;
}

/**
 * Decide whether the caller may perform `capability` on a business.
 *
 * `BILLING` is a peer of `ANALYST` in rank, so a rank comparison alone would let
 * an ANALYST manage billing. Billing is therefore checked exactly.
 */
export function canManageBusiness(ctx: AccessContext, capability: BusinessCapability): AccessDecision {
  const required = CAPABILITY_MIN_ROLE[capability];

  if (capability === "business:manage_billing") {
    if (ctx.membershipRole === "BILLING" || hasBusinessRole(ctx.membershipRole, "ADMIN")) {
      return { allowed: true, viaPlatformStaff: false, reason: "billing or business admin" };
    }
  } else if (hasBusinessRole(ctx.membershipRole, required)) {
    return { allowed: true, viaPlatformStaff: false, reason: `membership role ${ctx.membershipRole}` };
  }

  // Platform staff may act on any business for moderation/support, but this is
  // always distinguishable so the caller can write an audit entry.
  if (hasGlobalRole(ctx.globalRole, "ADMIN") && capability !== "business:delete") {
    return { allowed: true, viaPlatformStaff: true, reason: `platform ${ctx.globalRole}` };
  }

  return {
    allowed: false,
    viaPlatformStaff: false,
    reason: ctx.membershipRole ? `role ${ctx.membershipRole} lacks ${capability}` : "not a member of this business",
  };
}

// ─── Last-owner protection ────────────────────────────────────────────────────

export interface MembershipSummary {
  userId: string;
  role: BusinessRole;
}

/** A business must always retain at least one OWNER. */
export function wouldRemoveLastOwner(members: MembershipSummary[], targetUserId: string): boolean {
  const owners = members.filter((m) => m.role === "OWNER");
  return owners.length <= 1 && owners.some((m) => m.userId === targetUserId);
}

/** Demoting the sole owner is equally forbidden. */
export function wouldDemoteLastOwner(
  members: MembershipSummary[],
  targetUserId: string,
  nextRole: BusinessRole
): boolean {
  if (nextRole === "OWNER") return false;
  return wouldRemoveLastOwner(members, targetUserId);
}

/** Normalize an email for storage and comparison. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
