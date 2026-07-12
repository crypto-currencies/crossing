import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; href: string };
  className?: string;
}

/**
 * Genuine, functioning empty states — search with no results, an empty
 * saved list, an empty submission history. Distinct from
 * components/product/route-empty-state.tsx, which marks routes whose
 * workflow isn't wired up yet; every route that renders this one is fully
 * working, it just has nothing to show right now.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center gap-[14px] rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--panel)] px-[24px] py-[56px] text-center ${className ?? ""}`}
    >
      <div className="flex size-[44px] items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel-2)]">
        <Icon className="size-[18px] text-[var(--muted)]" aria-hidden />
      </div>
      <div className="stack-xs max-w-[360px]">
        <p className="t-label text-[var(--text)]">{title}</p>
        <p className="t-body-sm text-[var(--text-soft)]">{description}</p>
      </div>
      {action && (
        <Button variant="secondary" size="sm" asChild className="mt-[6px]">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}
