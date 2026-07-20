"use client";

import { useEffect, type ReactNode } from "react";
import { useAuthStore } from "@/store/auth";
import { ModalProvider } from "./modal-provider";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    useAuthStore.persist.rehydrate();
    useAuthStore.setState({ isLoading: false });
  }, []);

  return (
    <>
      {children}
      <ModalProvider />
    </>
  );
}
