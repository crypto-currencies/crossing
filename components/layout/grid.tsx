import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Tailwind can't see dynamically-built "gap-${n}" strings — map explicitly. */
const gapMap: Record<number, string> = {
  0: "gap-0",
  1: "gap-1",
  2: "gap-2",
  3: "gap-3",
  4: "gap-4",
  5: "gap-5",
  6: "gap-6",
  8: "gap-8",
  10: "gap-10",
  12: "gap-12",
  16: "gap-16",
};

const colsMap = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
  6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
  12: "grid-cols-12",
  "auto-sm": "grid-cols-[repeat(auto-fill,minmax(140px,1fr))]",
  "auto-md": "grid-cols-[repeat(auto-fill,minmax(200px,1fr))]",
  "auto-lg": "grid-cols-[repeat(auto-fill,minmax(280px,1fr))]",
} as const;

interface GridProps extends HTMLAttributes<HTMLDivElement> {
  cols?: keyof typeof colsMap;
  gap?: number;
}

export function Grid({ cols = 3, gap = 6, className, ...props }: GridProps) {
  return <div className={cn("grid", colsMap[cols], gapMap[gap], className)} {...props} />;
}

interface ColProps extends HTMLAttributes<HTMLDivElement> {
  span?: number;
}

export function Col({ span, className, style, ...props }: ColProps) {
  return (
    <div
      className={cn(className)}
      style={span ? { gridColumn: `span ${span} / span ${span}`, ...style } : style}
      {...props}
    />
  );
}

interface StackProps extends HTMLAttributes<HTMLDivElement> {
  gap?: number;
  align?: "start" | "center" | "end" | "stretch";
}

const alignMap = { start: "items-start", center: "items-center", end: "items-end", stretch: "items-stretch" };

export function Stack({ gap = 4, align = "stretch", className, ...props }: StackProps) {
  return <div className={cn("flex flex-col", alignMap[align], gapMap[gap], className)} {...props} />;
}

interface RowProps extends HTMLAttributes<HTMLDivElement> {
  gap?: number;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between";
}

const justifyMap = { start: "justify-start", center: "justify-center", end: "justify-end", between: "justify-between" };

export function Row({ gap = 4, align = "center", justify = "start", className, ...props }: RowProps) {
  return (
    <div
      className={cn("flex flex-row", alignMap[align], justifyMap[justify], gapMap[gap], className)}
      {...props}
    />
  );
}
