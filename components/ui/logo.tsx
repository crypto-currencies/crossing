import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href={ROUTES.root.home} className={cn("crossing-logo", className)} aria-label="Crossing home">
      <span className="crossing-logo-mark" aria-hidden>
        <span />
        <span />
      </span>
      <span className="crossing-logo-word">crossing</span>
    </Link>
  );
}
