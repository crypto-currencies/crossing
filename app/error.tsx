"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log digest only — full error.message/stack may contain sensitive details.
    // Replace this with your error-reporting service (e.g. Sentry) before launch.
    if (process.env.NODE_ENV !== "production") {
      console.error("[GlobalError]", error);
    }
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-[24px] px-6 text-center">
      <div className="flex flex-col items-center gap-[12px]">
        <h1 className="text-[24px] font-bold text-[var(--text)]">Something went wrong</h1>
        <p className="max-w-[360px] text-[14px] text-[var(--text-soft)]">
          An unexpected error occurred. The team has been notified.
          {error.digest && (
            <span className="mt-[6px] block font-mono text-[11px] text-[var(--muted)]">
              Error ID: {error.digest}
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-[8px]">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
