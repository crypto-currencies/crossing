"use client";

import { useUIStore } from "@/store/ui";

/** Renders whatever modals are currently pushed onto the UI store's stack. */
export function ModalProvider() {
  const modals = useUIStore((s) => s.modals);
  return <>{modals.map((m) => <div key={m.id}>{m.component}</div>)}</>;
}
