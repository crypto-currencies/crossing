import type { Category as CategoryRow } from "@prisma/client";
import type { Category } from "@/types";

export function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon,
    description: row.description,
    position: row.position,
  };
}
