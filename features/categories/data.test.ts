import assert from "node:assert/strict";
import { dbTest } from "@/lib/server/test-db-gate";
import { db } from "@/lib/db";
import { listActiveCategories, getCategoryBySlug } from "./data";

dbTest("listActiveCategories — excludes inactive categories", async () => {
  const suffix = Math.random().toString(36).slice(2, 8);
  const active = await db.category.create({
    data: { slug: `active-${suffix}`, name: `Active ${suffix}`, isActive: true },
  });
  const inactive = await db.category.create({
    data: { slug: `inactive-${suffix}`, name: `Inactive ${suffix}`, isActive: false },
  });

  try {
    const categories = await listActiveCategories();
    assert.ok(categories.some((c) => c.id === active.id));
    assert.ok(!categories.some((c) => c.id === inactive.id));
  } finally {
    await db.category.deleteMany({ where: { id: { in: [active.id, inactive.id] } } });
  }
});

dbTest("getCategoryBySlug — returns null for an unknown slug", async () => {
  const result = await getCategoryBySlug("definitely-not-a-real-category-slug");
  assert.equal(result, null);
});

dbTest("getCategoryBySlug — returns the matching category", async () => {
  const suffix = Math.random().toString(36).slice(2, 8);
  const category = await db.category.create({
    data: { slug: `lookup-${suffix}`, name: `Lookup ${suffix}`, isActive: true },
  });

  try {
    const result = await getCategoryBySlug(category.slug);
    assert.equal(result?.id, category.id);
  } finally {
    await db.category.delete({ where: { id: category.id } });
  }
});
