"use client";

import { AnimatePresence } from "framer-motion";
import { useUIStore } from "@/store/ui";

interface ModalProviderProps {
  children: React.ReactNode;
}

export function ModalProvider({ children }: ModalProviderProps) {
  const modals = useUIStore((s) => s.modals);

  return (
    <>
      {children}
      <AnimatePresence mode="sync">
        {modals.map((modal) => (
          <div key={modal.id}>{modal.component}</div>
        ))}
      </AnimatePresence>
    </>
  );
}
