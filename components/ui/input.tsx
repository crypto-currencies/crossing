import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-11 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-raised)] px-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none transition-colors duration-150",
      "focus:border-sky-500/60 focus:ring-2 focus:ring-sky-500/20",
      "disabled:opacity-40 disabled:pointer-events-none",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";
