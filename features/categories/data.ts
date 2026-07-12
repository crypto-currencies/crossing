import { db } from "@/lib/db";

/** Active categories, in manual display order. Used for nav / category pickers. */
export async function listActiveCategories() {
  return db.category.findMany({
    where: { isActive: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
}

export async function getCategoryBySlug(slug: string) {
  return db.category.findUnique({ where: { slug } });
}
