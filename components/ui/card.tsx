import { forwardRef, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Card shape system — four distinct treatments sharing one radius/border/
 * surface vocabulary so the page still reads as one site.
 *
 *  - tile  square, icon-forward.       Categories, compact link grids.
 *  - tall  vertical, compact.          Individual ranked results / listings.
 *  - wide  horizontal, stat-forward.   Summary stats, comparison panels.
 *  - row   minimal, text-only.         Dense lists (legal links, settings rows).
 */
const cardVariants = cva("rounded-lg border transition-colors duration-200", {
  variants: {
    shape: {
      tile: "aspect-square flex flex-col items-center justify-center gap-3 p-6 text-center border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[var(--border-default)]",
      tall: "flex flex-col justify-between gap-4 p-5 min-h-56 border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[var(--border-default)]",
      wide: "flex flex-row items-center gap-6 p-6 border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[var(--border-default)]",
      row: "flex items-center justify-between gap-4 px-4 py-3 rounded-md border-transparent hover:bg-white-100/5",
    },
  },
  defaultVariants: {
    shape: "tall",
  },
});

export interface CardProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(({ className, shape, ...props }, ref) => (
  <div ref={ref} className={cn(cardVariants({ shape }), className)} {...props} />
));
Card.displayName = "Card";
