import Link from "next/link";
import { CategoryIcon } from "./category-icon";
import type { CategorySummary } from "@/types";

/** Static server-renderable category link — used on the homepage and could be reused anywhere a category grid is needed. */
export function CategoryTile({ category, description }: { category: CategorySummary; description?: string | null }) {
  return (
    <Link
      href={`/category/${category.slug}`}
      className="hover-lift card group flex items-center gap-[14px] bg-[var(--panel)] border-[var(--border)] p-[16px]"
    >
      <span className="flex size-[38px] flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-2)] transition-colors group-hover:border-[var(--border-strong)]">
        <CategoryIcon name={category.icon} className="size-[16px] text-[var(--text-soft)]" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-[var(--text)]">{category.name}</span>
        {description && (
          <span className="mt-[2px] block truncate text-[11.5px] text-[var(--muted)]">{description}</span>
        )}
      </span>
    </Link>
  );
}
