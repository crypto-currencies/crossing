"use client";

/**
 * Client wrapper for the (root) route group.
 * Public/marketing pages always get the full Footer regardless of auth state.
 */

import { AppShell } from "./app-shell";
import { Footer } from "./footer";

export function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell sidebar={false} footer={<Footer />}>
      {children}
    </AppShell>
  );
}
