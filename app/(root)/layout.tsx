import { RootShell } from "@/components/layout/root-shell";

export default function RootGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RootShell>{children}</RootShell>;
}
