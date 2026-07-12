import assert from "node:assert/strict";
import { dbTest } from "@/lib/server/test-db-gate";
import { makeTestUser, makeTestCategory, makeTestListing } from "@/lib/server/test-fixtures";
import { saveListing, unsaveListing, hasSaved, listSavedListings } from "./data";
import { db } from "@/lib/db";

dbTest("saveListing — creates a save and increments the cached counter", async () => {
  const { user, cleanup: cleanupUser } = await makeTestUser();
  const { category, cleanup: cleanupCategory } = await makeTestCategory();
  const { listing, cleanup: cleanupListing } = await makeTestListing(category.id, user.id);

  try {
    const result = await saveListing(user.id, listing.id);
    assert.equal(result.saved, true);
    assert.equal(result.alreadySaved, false);

    const updated = await db.listing.findUniqueOrThrow({ where: { id: listing.id } });
    assert.equal(updated.saveCount, 1);
    assert.equal(await hasSaved(user.id, listing.id), true);
  } finally {
    await db.save.deleteMany({ where: { userId: user.id, listingId: listing.id } });
    await cleanupListing();
    await cleanupCategory();
    await cleanupUser();
  }
});

dbTest("saveListing — is idempotent under the DB unique constraint (duplicate save prevention)", async () => {
  const { user, cleanup: cleanupUser } = await makeTestUser();
  const { category, cleanup: cleanupCategory } = await makeTestCategory();
  const { listing, cleanup: cleanupListing } = await makeTestListing(category.id, user.id);

  try {
    const first = await saveListing(user.id, listing.id);
    const second = await saveListing(user.id, listing.id);

    assert.equal(first.alreadySaved, false);
    assert.equal(second.alreadySaved, true);

    // The counter must not have been double-incremented by the duplicate call.
    const updated = await db.listing.findUniqueOrThrow({ where: { id: listing.id } });
    assert.equal(updated.saveCount, 1);

    const rows = await db.save.findMany({ where: { userId: user.id, listingId: listing.id } });
    assert.equal(rows.length, 1);
  } finally {
    await db.save.deleteMany({ where: { userId: user.id, listingId: listing.id } });
    await cleanupListing();
    await cleanupCategory();
    await cleanupUser();
  }
});

dbTest("unsaveListing — removes the save and decrements the counter", async () => {
  const { user, cleanup: cleanupUser } = await makeTestUser();
  const { category, cleanup: cleanupCategory } = await makeTestCategory();
  const { listing, cleanup: cleanupListing } = await makeTestListing(category.id, user.id);

  try {
    await saveListing(user.id, listing.id);
    const result = await unsaveListing(user.id, listing.id);
    assert.equal(result.removed, true);
    assert.equal(await hasSaved(user.id, listing.id), false);

    const updated = await db.listing.findUniqueOrThrow({ where: { id: listing.id } });
    assert.equal(updated.saveCount, 0);
  } finally {
    await cleanupListing();
    await cleanupCategory();
    await cleanupUser();
  }
});

dbTest("unsaveListing — removing a non-existent save is a no-op, not an error", async () => {
  const { user, cleanup: cleanupUser } = await makeTestUser();
  const { category, cleanup: cleanupCategory } = await makeTestCategory();
  const { listing, cleanup: cleanupListing } = await makeTestListing(category.id, user.id);

  try {
    const result = await unsaveListing(user.id, listing.id);
    assert.equal(result.removed, false);
  } finally {
    await cleanupListing();
    await cleanupCategory();
    await cleanupUser();
  }
});

dbTest("listSavedListings — only returns the given user's saves, not another user's", async () => {
  const { user: userA, cleanup: cleanupA } = await makeTestUser();
  const { user: userB, cleanup: cleanupB } = await makeTestUser();
  const { category, cleanup: cleanupCategory } = await makeTestCategory();
  const { listing, cleanup: cleanupListing } = await makeTestListing(category.id, userA.id);

  try {
    await saveListing(userA.id, listing.id);

    const aResults = await listSavedListings(userA.id, { page: 1, pageSize: 20, skip: 0, take: 20 });
    const bResults = await listSavedListings(userB.id, { page: 1, pageSize: 20, skip: 0, take: 20 });

    assert.equal(aResults.total, 1);
    assert.equal(bResults.total, 0);
  } finally {
    await db.save.deleteMany({ where: { listingId: listing.id } });
    await cleanupListing();
    await cleanupCategory();
    await cleanupA();
    await cleanupB();
  }
});
