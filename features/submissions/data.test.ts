import assert from "node:assert/strict";
import { dbTest } from "@/lib/server/test-db-gate";
import { makeTestUser, makeTestCategory, makeTestListing } from "@/lib/server/test-fixtures";
import {
  createSubmission,
  listUserSubmissions,
  approveSubmission,
  rejectSubmission,
} from "./data";
import { db } from "@/lib/db";
import { getListingBySlug } from "@/features/listings/data";

function input(overrides: Partial<Parameters<typeof createSubmission>[1]> = {}) {
  return {
    name: "Test Product",
    websiteUrl: `https://example.com/product-${Math.random().toString(36).slice(2, 8)}`,
    tagline: "A tagline long enough to pass validation.",
    description: "A description that is long enough to satisfy the minimum length requirement for submissions.",
    categoryId: "",
    ...overrides,
  };
}

dbTest("createSubmission — rejects an invalid categoryId", async () => {
  const { user, cleanup } = await makeTestUser();
  try {
    const result = await createSubmission(user.id, input({ categoryId: "does-not-exist" }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "invalid_category");
  } finally {
    await cleanup();
  }
});

dbTest("createSubmission — succeeds for a valid, non-duplicate submission", async () => {
  const { user, cleanup: cleanupUser } = await makeTestUser();
  const { category, cleanup: cleanupCategory } = await makeTestCategory();

  try {
    const result = await createSubmission(user.id, input({ categoryId: category.id }));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.submission.status, "PENDING");
      await db.submission.delete({ where: { id: result.submission.id } });
    }
  } finally {
    await cleanupCategory();
    await cleanupUser();
  }
});

dbTest("createSubmission — rejects a second PENDING submission for the same URL from the same user", async () => {
  const { user, cleanup: cleanupUser } = await makeTestUser();
  const { category, cleanup: cleanupCategory } = await makeTestCategory();
  const sharedInput = input({ categoryId: category.id });

  try {
    const first = await createSubmission(user.id, sharedInput);
    assert.equal(first.ok, true);

    const second = await createSubmission(user.id, sharedInput);
    assert.equal(second.ok, false);
    if (!second.ok) assert.equal(second.error, "duplicate_pending");

    if (first.ok) await db.submission.delete({ where: { id: first.submission.id } });
  } finally {
    await cleanupCategory();
    await cleanupUser();
  }
});

dbTest("createSubmission — rejects a URL that already belongs to a published listing", async () => {
  const { user, cleanup: cleanupUser } = await makeTestUser();
  const { category, cleanup: cleanupCategory } = await makeTestCategory();
  const { listing, cleanup: cleanupListing } = await makeTestListing(category.id, user.id);

  try {
    const result = await createSubmission(
      user.id,
      input({ categoryId: category.id, websiteUrl: listing.websiteUrl })
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "duplicate_listing");
  } finally {
    await cleanupListing();
    await cleanupCategory();
    await cleanupUser();
  }
});

dbTest("listUserSubmissions — only returns the calling user's own submissions (authorization scoping)", async () => {
  const { user: userA, cleanup: cleanupA } = await makeTestUser();
  const { user: userB, cleanup: cleanupB } = await makeTestUser();
  const { category, cleanup: cleanupCategory } = await makeTestCategory();

  try {
    const created = await createSubmission(userA.id, input({ categoryId: category.id }));
    assert.equal(created.ok, true);

    const aResults = await listUserSubmissions(userA.id, { page: 1, pageSize: 20, skip: 0, take: 20 });
    const bResults = await listUserSubmissions(userB.id, { page: 1, pageSize: 20, skip: 0, take: 20 });

    assert.equal(aResults.total, 1);
    assert.equal(bResults.total, 0);

    if (created.ok) await db.submission.delete({ where: { id: created.submission.id } });
  } finally {
    await cleanupCategory();
    await cleanupA();
    await cleanupB();
  }
});

dbTest("approveSubmission — creates a published Listing and links it back to the submission", async () => {
  const { user, cleanup: cleanupUser } = await makeTestUser();
  const { user: admin, cleanup: cleanupAdmin } = await makeTestUser({ role: "ADMIN" });
  const { category, cleanup: cleanupCategory } = await makeTestCategory();

  const created = await createSubmission(user.id, input({ categoryId: category.id }));
  assert.equal(created.ok, true);
  if (!created.ok) return;

  try {
    const result = await approveSubmission(created.submission.id, admin.id);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const listing = await getListingBySlug(result.listingSlug);
    assert.ok(listing);
    assert.equal(listing?.status, "PUBLISHED");

    const submission = await db.submission.findUniqueOrThrow({ where: { id: created.submission.id } });
    assert.equal(submission.status, "APPROVED");
    assert.ok(submission.listingId);

    const notification = await db.notification.findFirst({
      where: { userId: user.id, type: "submission_approved" },
    });
    assert.ok(notification);

    await db.notification.deleteMany({ where: { userId: user.id } });
    await db.listing.delete({ where: { slug: result.listingSlug } });
  } finally {
    await db.submission.deleteMany({ where: { id: created.submission.id } });
    await cleanupCategory();
    await cleanupAdmin();
    await cleanupUser();
  }
});

dbTest("rejectSubmission — marks the submission REJECTED and never creates a Listing", async () => {
  const { user, cleanup: cleanupUser } = await makeTestUser();
  const { user: admin, cleanup: cleanupAdmin } = await makeTestUser({ role: "ADMIN" });
  const { category, cleanup: cleanupCategory } = await makeTestCategory();

  const created = await createSubmission(user.id, input({ categoryId: category.id }));
  assert.equal(created.ok, true);
  if (!created.ok) return;

  try {
    const result = await rejectSubmission(created.submission.id, admin.id, "not a good fit");
    assert.equal(result.ok, true);

    const submission = await db.submission.findUniqueOrThrow({ where: { id: created.submission.id } });
    assert.equal(submission.status, "REJECTED");
    assert.equal(submission.moderatorNote, "not a good fit");
    assert.equal(submission.listingId, null);

    // Rejected content never appears publicly because it never became a Listing.
    const listingCount = await db.listing.count({ where: { submittedById: user.id } });
    assert.equal(listingCount, 0);

    await db.notification.deleteMany({ where: { userId: user.id } });
  } finally {
    await db.submission.deleteMany({ where: { id: created.submission.id } });
    await cleanupCategory();
    await cleanupAdmin();
    await cleanupUser();
  }
});

dbTest("approveSubmission — refuses to approve a submission that isn't PENDING", async () => {
  const { user, cleanup: cleanupUser } = await makeTestUser();
  const { user: admin, cleanup: cleanupAdmin } = await makeTestUser({ role: "ADMIN" });
  const { category, cleanup: cleanupCategory } = await makeTestCategory();

  const created = await createSubmission(user.id, input({ categoryId: category.id }));
  assert.equal(created.ok, true);
  if (!created.ok) return;

  try {
    const firstApproval = await approveSubmission(created.submission.id, admin.id);
    assert.equal(firstApproval.ok, true);

    const secondApproval = await approveSubmission(created.submission.id, admin.id);
    assert.equal(secondApproval.ok, false);
    if (!secondApproval.ok) assert.equal(secondApproval.error, "not_pending");

    if (firstApproval.ok) {
      await db.notification.deleteMany({ where: { userId: user.id } });
      await db.listing.delete({ where: { slug: firstApproval.listingSlug } });
    }
  } finally {
    await db.submission.deleteMany({ where: { id: created.submission.id } });
    await cleanupCategory();
    await cleanupAdmin();
    await cleanupUser();
  }
});
