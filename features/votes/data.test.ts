import assert from "node:assert/strict";
import { dbTest } from "@/lib/server/test-db-gate";
import { makeTestUser, makeTestCategory, makeTestListing } from "@/lib/server/test-fixtures";
import { addVote, removeVote, hasVoted, listVotedListings } from "./data";
import { db } from "@/lib/db";

dbTest("addVote — creates a vote and increments the cached counter", async () => {
  const { user, cleanup: cleanupUser } = await makeTestUser();
  const { category, cleanup: cleanupCategory } = await makeTestCategory();
  const { listing, cleanup: cleanupListing } = await makeTestListing(category.id, user.id);

  try {
    const result = await addVote(user.id, listing.id);
    assert.equal(result.voted, true);
    assert.equal(result.alreadyVoted, false);

    const updated = await db.listing.findUniqueOrThrow({ where: { id: listing.id } });
    assert.equal(updated.voteCount, 1);
    assert.equal(await hasVoted(user.id, listing.id), true);
  } finally {
    await db.vote.deleteMany({ where: { userId: user.id, listingId: listing.id } });
    await cleanupListing();
    await cleanupCategory();
    await cleanupUser();
  }
});

dbTest("addVote — is idempotent under the DB unique constraint (duplicate vote prevention)", async () => {
  const { user, cleanup: cleanupUser } = await makeTestUser();
  const { category, cleanup: cleanupCategory } = await makeTestCategory();
  const { listing, cleanup: cleanupListing } = await makeTestListing(category.id, user.id);

  try {
    const first = await addVote(user.id, listing.id);
    const second = await addVote(user.id, listing.id);

    assert.equal(first.alreadyVoted, false);
    assert.equal(second.alreadyVoted, true);

    const updated = await db.listing.findUniqueOrThrow({ where: { id: listing.id } });
    assert.equal(updated.voteCount, 1);

    const rows = await db.vote.findMany({ where: { userId: user.id, listingId: listing.id } });
    assert.equal(rows.length, 1);
  } finally {
    await db.vote.deleteMany({ where: { userId: user.id, listingId: listing.id } });
    await cleanupListing();
    await cleanupCategory();
    await cleanupUser();
  }
});

dbTest("removeVote — removes the vote and decrements the counter", async () => {
  const { user, cleanup: cleanupUser } = await makeTestUser();
  const { category, cleanup: cleanupCategory } = await makeTestCategory();
  const { listing, cleanup: cleanupListing } = await makeTestListing(category.id, user.id);

  try {
    await addVote(user.id, listing.id);
    const result = await removeVote(user.id, listing.id);
    assert.equal(result.removed, true);
    assert.equal(await hasVoted(user.id, listing.id), false);

    const updated = await db.listing.findUniqueOrThrow({ where: { id: listing.id } });
    assert.equal(updated.voteCount, 0);
  } finally {
    await cleanupListing();
    await cleanupCategory();
    await cleanupUser();
  }
});

dbTest("listVotedListings — only returns the given user's votes, not another user's", async () => {
  const { user: userA, cleanup: cleanupA } = await makeTestUser();
  const { user: userB, cleanup: cleanupB } = await makeTestUser();
  const { category, cleanup: cleanupCategory } = await makeTestCategory();
  const { listing, cleanup: cleanupListing } = await makeTestListing(category.id, userA.id);

  try {
    await addVote(userA.id, listing.id);

    const aResults = await listVotedListings(userA.id, { page: 1, pageSize: 20, skip: 0, take: 20 });
    const bResults = await listVotedListings(userB.id, { page: 1, pageSize: 20, skip: 0, take: 20 });

    assert.equal(aResults.total, 1);
    assert.equal(bResults.total, 0);
  } finally {
    await db.vote.deleteMany({ where: { listingId: listing.id } });
    await cleanupListing();
    await cleanupCategory();
    await cleanupA();
    await cleanupB();
  }
});
