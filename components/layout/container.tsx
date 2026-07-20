import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const sizes = {
  xs: "max-w-[480px]",
  content: "max-w-[720px]",
  lg: "max-w-[1024px]",
  xl: "max-w-[1200px]",
  wide: "max-w-[1400px]",
} as const;

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: keyof typeof sizes;
}

export function Container({ size = "xl", className, ...props }: ContainerProps) {
  return <div className={cn("mx-auto w-full px-4 sm:px-6", sizes[size], className)} {...props} />;
}
