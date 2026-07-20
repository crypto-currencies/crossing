import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--surface-base)] px-4 py-16">
      <Logo className="mb-10" />
      {children}
    </div>
  );
}
