import { forwardRef } from "react";
import { cn } from "@/lib/utils";

// Responsive grid system with named column presets
interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?:
    | 1
    | 2
    | 3
    | 4
    | 6
    | 12
    | "cards"
    | "browse"
    | "dashboard"
    | "profile"
    | "auto-sm"
    | "auto-md"
    | "auto-lg";
  gap?: "xs" | "sm" | "md" | "lg" | "xl";
}

const colsMap = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
  12: "grid-cols-12",
  // Auto-fill responsive grids
  cards: "grid-cols-[repeat(auto-fit,minmax(220px,1fr))]",
  browse: "grid-cols-[repeat(auto-fill,minmax(230px,1fr))]",
  dashboard: "grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]",
  profile: "grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px]",
  "auto-sm": "grid-cols-[repeat(auto-fill,minmax(180px,1fr))]",
  "auto-md": "grid-cols-[repeat(auto-fill,minmax(230px,1fr))]",
  "auto-lg": "grid-cols-[repeat(auto-fill,minmax(280px,1fr))]",
};

const gapMap = {
  xs: "gap-[var(--small-padding)]",
  sm: "gap-[var(--small-padding)]",
  md: "gap-[var(--card-gap)]",
  lg: "gap-[var(--block-gap)]",
  xl: "gap-[calc(var(--block-gap) + 12px)]",
};

export const Grid = forwardRef<HTMLDivElement, GridProps>(
  ({ className, cols = 3, gap = "md", ...props }, ref) => (
    <div
      ref={ref}
      className={cn("grid", colsMap[cols], gapMap[gap], className)}
      {...props}
    />
  )
);
Grid.displayName = "Grid";

// Named col-span helpers
interface ColProps extends React.HTMLAttributes<HTMLDivElement> {
  span?: 1 | 2 | 3 | 4 | 6 | 8 | 12 | "full";
  smSpan?: 1 | 2 | 3 | 4 | 6 | 8 | 12 | "full";
  lgSpan?: 1 | 2 | 3 | 4 | 6 | 8 | 12 | "full";
}

const spanMap = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
  6: "col-span-6",
  8: "col-span-8",
  12: "col-span-12",
  full: "col-span-full",
};

export const Col = forwardRef<HTMLDivElement, ColProps>(
  ({ className, span = 1, smSpan, lgSpan, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        spanMap[span],
        smSpan && `sm:${spanMap[smSpan]}`,
        lgSpan && `lg:${spanMap[lgSpan]}`,
        className
      )}
      {...props}
    />
  )
);
Col.displayName = "Col";

// Stack — vertical flex with consistent gap
interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  align?: "start" | "center" | "end" | "stretch";
}

const stackGapMap = {
  xs: "gap-[var(--stack-xs)]",
  sm: "gap-[var(--stack-sm)]",
  md: "gap-[var(--stack-md)]",
  lg: "gap-[var(--stack-lg)]",
  xl: "gap-[var(--stack-xl)]",
  "2xl": "gap-[var(--block-gap)]",
};

const alignMap = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
};

export const Stack = forwardRef<HTMLDivElement, StackProps>(
  ({ className, gap = "md", align = "stretch", ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col", stackGapMap[gap], alignMap[align], className)}
      {...props}
    />
  )
);
Stack.displayName = "Stack";

// Row — horizontal flex with consistent gap
interface RowProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  align?: "start" | "center" | "end" | "baseline" | "stretch";
  justify?: "start" | "center" | "end" | "between" | "around";
  wrap?: boolean;
}

const justifyMap = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
};

export const Row = forwardRef<HTMLDivElement, RowProps>(
  ({ className, gap = "md", align = "center", justify = "start", wrap, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex",
        stackGapMap[gap],
        alignMap[align],
        justifyMap[justify],
        wrap && "flex-wrap",
        className
      )}
      {...props}
    />
  )
);
Row.displayName = "Row";
