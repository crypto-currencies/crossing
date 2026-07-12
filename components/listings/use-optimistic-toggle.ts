"use client";

import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useProductActions } from "@/components/product/product-modals";
import { useToastStore } from "@/store/toast";

interface UseOptimisticToggleOptions {
  listingSlug: string;
  endpoint: "save" | "vote";
  initialActive: boolean;
  initialCount: number;
  signInReason: string;
  errorMessage: string;
  /** Fires after a successful toggle (not on rollback) — e.g. to drop the item from a "my saved" list once unsaved. */
  onSettled?: (active: boolean) => void;
}

/**
 * Shared optimistic on/off toggle for the Save and Recommend (vote)
 * controls. Both follow the identical POST-to-add / DELETE-to-remove /
 * idempotent-either-way shape against `/api/listings/[slug]/{save,vote}`.
 */
export function useOptimisticToggle({
  listingSlug,
  endpoint,
  initialActive,
  initialCount,
  signInReason,
  errorMessage,
  onSettled,
}: UseOptimisticToggleOptions) {
  const [active, setActive] = useState(initialActive);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);
  const { guarded } = useProductActions();
  const { error: toastError } = useToastStore();
  const pathname = usePathname();

  const toggle = useCallback(() => {
    guarded(
      signInReason,
      () => {
        if (pending) return;
        const nextActive = !active;
        setActive(nextActive);
        setCount((c) => Math.max(0, c + (nextActive ? 1 : -1)));
        setPending(true);

        fetch(`/api/listings/${listingSlug}/${endpoint}`, {
          method: nextActive ? "POST" : "DELETE",
          headers: { "Content-Type": "application/json" },
        })
          .then((res) => {
            if (!res.ok) throw new Error(String(res.status));
            onSettled?.(nextActive);
          })
          .catch(() => {
            // Roll back on failure — the server state didn't change.
            setActive(!nextActive);
            setCount((c) => Math.max(0, c + (nextActive ? -1 : 1)));
            toastError(errorMessage);
          })
          .finally(() => setPending(false));
      },
      pathname
    );
  }, [active, endpoint, errorMessage, guarded, listingSlug, onSettled, pathname, pending, signInReason, toastError]);

  return { active, count, pending, toggle };
}
