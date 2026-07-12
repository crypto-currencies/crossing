/**
 * Map Prisma DB records → domain types (types/index.ts).
 * Only contains mappers for models that exist in the current schema.
 */

import type { User as DbUser, Notification as DbNotification } from "@prisma/client";
import type { User, Notification } from "@/types";

// ─── User ─────────────────────────────────────────────────────────────────────

export function mapUser(u: DbUser, opts?: { includeEmail?: boolean }): User {
  // `role` is included alongside email — only for own-user endpoints so the
  // client can gate admin UI. Public endpoints omit both.
  const includePrivateFields = opts?.includeEmail ?? false;
  return {
    id: u.id,
    name: u.name ?? null,
    ...(includePrivateFields ? { email: u.email ?? null } : {}),
    ...(includePrivateFields
      ? { emailVerifiedAt: u.emailVerifiedAt?.toISOString() ?? null }
      : {}),
    ...(includePrivateFields ? { role: u.role as User["role"] } : {}),
    image: u.image ?? null,
    verified: u.verified,
    onboardingCompleted: u.onboardingCompleted,
    joinedAt: u.createdAt.toISOString(),
  };
}

// ─── Notification ─────────────────────────────────────────────────────────────

export function mapNotification(n: DbNotification): Notification {
  return {
    id: n.id,
    type: n.type as Notification["type"],
    read: n.read,
    title: n.title,
    body: n.body,
    href: n.href ?? undefined,
    entityId: n.entityId ?? undefined,
    entityType: n.entityType ?? undefined,
    createdAt: n.createdAt.toISOString(),
  };
}
