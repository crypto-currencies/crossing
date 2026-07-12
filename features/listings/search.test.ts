import assert from "node:assert/strict";
import { dbTest } from "@/lib/server/test-db-gate";
import { makeTestUser, makeTestCategory } from "@/lib/server/test-fixtures";
import { searchListings } from "./search";
import { db } from "@/lib/db";

async function makeSearchableListing(
  categoryId: string,
  submittedById: string,
  fields: { name?: string; tagline?: string; description?: string; status?: "PUBLISHED" | "ARCHIVED" }
) {
  const suffix = Math.random().toString(36).slice(2, 10);
  return db.listing.create({
    data: {
      name: fields.name ?? `Listing ${suffix}`,
      slug: `search-test-${suffix}`,
      tagline: fields.tagline ?? "A generic tagline.",
      description: fields.description ?? "A generic description.",
      websiteUrl: `https://example.com/search-${suffix}`,
      websiteUrlKey: `example.com/search-${suffix}`,
      categoryId,
      submittedById,
      status: fields.status ?? "PUBLISHED",
    },
  });
}

dbTest("searchListings — matches case-insensitively on name", async () => {
  const { user, cleanup: cleanupUser } = await makeTestUser();
  const { category, cleanup: cleanupCategory } = await makeTestCategory();
  const listing = await makeSearchableListing(category.id, user.id, { name: "Zephyrine Widgetizer" });

  try {
    const result = await searchListings({ q: "zephyrine" }, { page: 1, pageSize: 20, skip: 0, take: 20 });
    assert.ok(result.items.some((i) => i.id === listing.id));
  } finally {
    await db.listing.delete({ where: { id: listing.id } });
    await cleanupCategory();
    await cleanupUser();
  }
});

dbTest("searchListings — matches on tagline and description, not just name", async () => {
  const { user, cleanup: cleanupUser } = await makeTestUser();
  const { category, cleanup: cleanupCategory } = await makeTestCategory();
  const listing = await makeSearchableListing(category.id, user.id, {
    tagline: "Uniquetaglinekeyword for search matching.",
  });

  try {
    const result = await searchListings(
      { q: "uniquetaglinekeyword" },
      { page: 1, pageSize: 20, skip: 0, take: 20 }
    );
    assert.ok(result.items.some((i) => i.id === listing.id));
  } finally {
    await db.listing.delete({ where: { id: listing.id } });
    await cleanupCategory();
    await cleanupUser();
  }
});

dbTest("searchListings — excludes non-matching listings", async () => {
  const { user, cleanup: cleanupUser } = await makeTestUser();
  const { category, cleanup: cleanupCategory } = await makeTestCategory();
  const listing = await makeSearchableListing(category.id, user.id, { name: "Totally Unrelated Thing" });

  try {
    const result = await searchListings(
      { q: "nonexistentsearchtermxyz" },
      { page: 1, pageSize: 20, skip: 0, take: 20 }
    );
    assert.ok(!result.items.some((i) => i.id === listing.id));
  } finally {
    await db.listing.delete({ where: { id: listing.id } });
    await cleanupCategory();
    await cleanupUser();
  }
});

dbTest("searchListings — empty query falls through to the general published feed, not an error or empty set", async () => {
  const { user, cleanup: cleanupUser } = await makeTestUser();
  const { category, cleanup: cleanupCategory } = await makeTestCategory();
  const listing = await makeSearchableListing(category.id, user.id, {});

  try {
    const result = await searchListings({ q: "" }, { page: 1, pageSize: 20, skip: 0, take: 20 });
    assert.ok(result.items.some((i) => i.id === listing.id));
  } finally {
    await db.listing.delete({ where: { id: listing.id } });
    await cleanupCategory();
    await cleanupUser();
  }
});

dbTest("searchListings — category filter excludes matches from other categories", async () => {
  const { user, cleanup: cleanupUser } = await makeTestUser();
  const { category: categoryA, cleanup: cleanupA } = await makeTestCategory();
  const { category: categoryB, cleanup: cleanupB } = await makeTestCategory();
  const nameToken = `Findme${Math.random().toString(36).slice(2, 8)}`;
  const inA = await makeSearchableListing(categoryA.id, user.id, { name: nameToken });
  const inB = await makeSearchableListing(categoryB.id, user.id, { name: nameToken });

  try {
    const result = await searchListings(
      { q: nameToken, categorySlug: categoryA.slug },
      { page: 1, pageSize: 20, skip: 0, take: 20 }
    );
    assert.ok(result.items.some((i) => i.id === inA.id));
    assert.ok(!result.items.some((i) => i.id === inB.id));
  } finally {
    await db.listing.deleteMany({ where: { id: { in: [inA.id, inB.id] } } });
    await cleanupA();
    await cleanupB();
    await cleanupUser();
  }
});

dbTest("searchListings — never returns an ARCHIVED listing", async () => {
  const { user, cleanup: cleanupUser } = await makeTestUser();
  const { category, cleanup: cleanupCategory } = await makeTestCategory();
  const listing = await makeSearchableListing(category.id, user.id, {
    name: "Archivedmatchonlytoken",
    status: "ARCHIVED",
  });

  try {
    const result = await searchListings(
      { q: "archivedmatchonlytoken" },
      { page: 1, pageSize: 20, skip: 0, take: 20 }
    );
    assert.ok(!result.items.some((i) => i.id === listing.id));
  } finally {
    await db.listing.delete({ where: { id: listing.id } });
    await cleanupCategory();
    await cleanupUser();
  }
});

dbTest("searchListings — respects pagination bounds", async () => {
  const { user, cleanup: cleanupUser } = await makeTestUser();
  const { category, cleanup: cleanupCategory } = await makeTestCategory();
  const token = `Pagetoken${Math.random().toString(36).slice(2, 8)}`;
  const listings = await Promise.all(
    Array.from({ length: 3 }, () => makeSearchableListing(category.id, user.id, { name: token }))
  );

  try {
    const page1 = await searchListings({ q: token }, { page: 1, pageSize: 2, skip: 0, take: 2 });
    const page2 = await searchListings({ q: token }, { page: 2, pageSize: 2, skip: 2, take: 2 });

    assert.equal(page1.items.length, 2);
    assert.equal(page2.items.length, 1);
    assert.equal(page1.total, 3);
  } finally {
    await db.listing.deleteMany({ where: { id: { in: listings.map((l) => l.id) } } });
    await cleanupCategory();
    await cleanupUser();
  }
});
