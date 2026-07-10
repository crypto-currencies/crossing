"use client";

import { useSyncExternalStore } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeviceTier {
  /** True when the device is likely constrained: ≤4 CPU cores, ≤4 GB RAM,
   *  Save-Data header active, or a 2G/slow-2G connection detected. */
  isLowEnd: boolean;
  /** True when the OS / browser requests reduced motion. */
  prefersReducedMotion: boolean;
  /** True when the browser's Save-Data flag is on. */
  saveData: boolean;
  /** True when the primary pointer is coarse (touch screen). */
  isTouchPrimary: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type NavExt = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
};

/**
 * Module-level cache for the last computed snapshot.
 * useSyncExternalStore uses Object.is to compare snapshots — if getSnapshot
 * returns a new object reference on every call React will loop infinitely.
 * We only allocate a new object when a field value actually changes.
 */
let _cached: DeviceTier | null = null;

function getSnapshot(): DeviceTier {
  const nav = navigator as NavExt;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  const isTouchPrimary = window.matchMedia("(pointer: coarse)").matches;

  const cores    = navigator.hardwareConcurrency ?? 8;
  const mem      = nav.deviceMemory ?? 8; // GB; undefined → assume high-end
  const conn     = nav.connection;
  const saveData = conn?.saveData ?? false;
  const slowNet  =
    conn?.effectiveType === "2g" || conn?.effectiveType === "slow-2g";

  const isLowEnd = cores <= 4 || mem <= 4 || saveData || slowNet;

  // Return the cached object if nothing changed — avoids the infinite-loop
  // React warning about snapshots that are never equal to themselves.
  if (
    _cached !== null &&
    _cached.isLowEnd             === isLowEnd &&
    _cached.prefersReducedMotion === prefersReducedMotion &&
    _cached.saveData             === saveData &&
    _cached.isTouchPrimary       === isTouchPrimary
  ) {
    return _cached;
  }

  _cached = { isLowEnd, prefersReducedMotion, saveData, isTouchPrimary };
  return _cached;
}

/** SSR / pre-hydration snapshot — assume capable device. */
const SERVER_SNAPSHOT: DeviceTier = {
  isLowEnd:             false,
  prefersReducedMotion: false,
  saveData:             false,
  isTouchPrimary:       false,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns live capability signals for the current device.
 * Subscribes to `prefers-reduced-motion` and `pointer` changes so the
 * value stays accurate if the user toggles OS accessibility settings.
 *
 * Safe to call in any client component — returns a neutral/high-end
 * snapshot during SSR so no hydration mismatch occurs.
 */
export function useDeviceTier(): DeviceTier {
  return useSyncExternalStore(
    (onChange) => {
      const rmMq  = window.matchMedia("(prefers-reduced-motion: reduce)");
      const ptrMq = window.matchMedia("(pointer: coarse)");
      rmMq.addEventListener("change", onChange);
      ptrMq.addEventListener("change", onChange);
      return () => {
        rmMq.removeEventListener("change", onChange);
        ptrMq.removeEventListener("change", onChange);
      };
    },
    getSnapshot,
    () => SERVER_SNAPSHOT,
  );
}
