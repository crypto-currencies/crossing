import { db } from "@/lib/db";

/** Active categories, in manual display order. Used for nav / category pickers. */
export async function listActiveCategories() {
  return db.category.findMany({
    where: { isActive: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
}

/** Active homepage categories with a real count of published listings. */
export async function listActiveCategoriesWithCounts() {
  return db.category.findMany({
    where: { isActive: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: { listings: { where: { status: "PUBLISHED" } } },
      },
    },
  });
}

export async function getCategoryBySlug(slug: string) {
  return db.category.findUnique({ where: { slug } });
}
