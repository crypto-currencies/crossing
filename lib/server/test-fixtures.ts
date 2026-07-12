/**
 * Shared fixture helpers for DB-gated integration tests (see test-db-gate.ts).
 * Every fixture is created with a random suffix so parallel/repeated test
 * runs never collide with each other or with real data, and every helper
 * that creates a row also cleans it up via the returned `cleanup()`.
 */

import { db } from "@/lib/db";

function rand(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function makeTestUser(overrides: { role?: "USER" | "MODERATOR" | "ADMIN" | "OWNER" } = {}) {
  const suffix = rand();
  const user = await db.user.create({
    data: {
      email: `test-${suffix}@fixtures.crossing.dev`,
      name: `Test User ${suffix}`,
      verified: true,
      role: overrides.role ?? "USER",
    },
  });
  return { user, cleanup: () => db.user.delete({ where: { id: user.id } }).catch(() => {}) };
}

export async function makeTestCategory() {
  const suffix = rand();
  const category = await db.category.create({
    data: {
      slug: `test-category-${suffix}`,
      name: `Test Category ${suffix}`,
      isActive: true,
    },
  });
  return { category, cleanup: () => db.category.delete({ where: { id: category.id } }).catch(() => {}) };
}

export async function makeTestListing(
  categoryId: string,
  submittedById: string,
  overrides: Partial<{ status: "PUBLISHED" | "ARCHIVED" }> = {}
) {
  const suffix = rand();
  const listing = await db.listing.create({
    data: {
      name: `Test Listing ${suffix}`,
      slug: `test-listing-${suffix}`,
      tagline: "A fixture listing for integration tests.",
      description: "Created by lib/server/test-fixtures.ts — safe to delete.",
      websiteUrl: `https://example.com/test-${suffix}`,
      websiteUrlKey: `example.com/test-${suffix}`,
      categoryId,
      submittedById,
      status: overrides.status ?? "PUBLISHED",
    },
  });
  return { listing, cleanup: () => db.listing.delete({ where: { id: listing.id } }).catch(() => {}) };
}
