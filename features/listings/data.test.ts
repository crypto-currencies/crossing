import assert from "node:assert/strict";
import { dbTest } from "@/lib/server/test-db-gate";
import { makeTestUser, makeTestCategory } from "@/lib/server/test-fixtures";
import { db } from "@/lib/db";
import {
  listPublishedListings,
  listTrendingListings,
  listNewestListings,
  listListingsByCategory,
  getListingBySlug,
} from "./data";

const PAGE = { page: 1, pageSize: 20, skip: 0, take: 20 };

async function makeListing(
  categoryId: string,
  submittedById: string,
  status: "PUBLISHED" | "ARCHIVED" = "PUBLISHED"
) {
  const suffix = Math.random().toString(36).slice(2, 10);
  return db.listing.create({
    data: {
      name: `Listing ${suffix}`,
      slug: `data-test-${suffix}`,
      tagline: "A fixture listing.",
      description: "Created by features/listings/data.test.ts.",
      websiteUrl: `https://example.com/data-${suffix}`,
      websiteUrlKey: `example.com/data-${suffix}`,
      categoryId,
      submittedById,
      status,
    },
  });
}

dbTest("listPublishedListings / listTrendingListings / listNewestListings — never include an ARCHIVED listing", async () => {
  const { user, cleanup: cleanupUser } = await makeTestUser();
  const { category, cleanup: cleanupCategory } = await makeTestCategory();
  const archived = await makeListing(category.id, user.id, "ARCHIVED");

  try {
    const [published, trending, newest] = await Promise.all([
      listPublishedListings(PAGE),
      listTrendingListings(PAGE),
      listNewestListings(PAGE),
    ]);
    for (const result of [published, trending, newest]) {
      assert.ok(!result.items.some((i) => i.id === archived.id));
    }
  } finally {
    await db.listing.delete({ where: { id: archived.id } });
    await cleanupCategory();
    await cleanupUser();
  }
});

dbTest("listListingsByCategory — only returns listings in that category", async () => {
  const { user, cleanup: cleanupUser } = await makeTestUser();
  const { category: categoryA, cleanup: cleanupA } = await makeTestCategory();
  const { category: categoryB, cleanup: cleanupB } = await makeTestCategory();
  const inA = await makeListing(categoryA.id, user.id);
  const inB = await makeListing(categoryB.id, user.id);

  try {
    const result = await listListingsByCategory(categoryA.slug, PAGE);
    assert.ok(result.items.some((i) => i.id === inA.id));
    assert.ok(!result.items.some((i) => i.id === inB.id));
  } finally {
    await db.listing.deleteMany({ where: { id: { in: [inA.id, inB.id] } } });
    await cleanupA();
    await cleanupB();
    await cleanupUser();
  }
});

dbTest("getListingBySlug — returns null for an unknown slug", async () => {
  const result = await getListingBySlug("definitely-not-a-real-listing-slug");
  assert.equal(result, null);
});
