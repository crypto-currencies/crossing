"use client";

import { useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (callback) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", callback);
      return () => mq.removeEventListener("change", callback);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

export const useMobile = () => useMediaQuery("(max-width: 767px)");
export const useTablet = () => useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
export const useDesktop = () => useMediaQuery("(min-width: 1024px)");
