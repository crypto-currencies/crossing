"use client";

import Link from "next/link";
import { Search, Bookmark, SquarePlus } from "lucide-react";
import { PageHeader, SectionShell } from "@/components/layout/surface";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";

export function DashboardClient() {
  const { user } = useAuthStore();

  return (
    <div className="page-stack">
      <SectionShell spacing="tight">
        <PageHeader
          title={`Welcome${user?.name ? `, ${user.name}` : ""}`}
          description="Your account is set up. Here's where to go next."
        />
      </SectionShell>
      <SectionShell spacing="default">
        <Card variant="default" padding="xl" className="max-w-[720px] stack-lg">
          <p className="t-body-sm text-[var(--text-soft)]">
            Browse what&rsquo;s worth your time, save listings for later, or submit
            something you think belongs on Crossing.dev.
          </p>
          <div className="flex flex-wrap gap-[10px]">
            <Button variant="secondary" size="md" asChild>
              <Link href="/search" className="flex items-center gap-[6px]">
                <Search className="size-[14px]" />
                Search
              </Link>
            </Button>
            <Button variant="secondary" size="md" asChild>
              <Link href="/saved" className="flex items-center gap-[6px]">
                <Bookmark className="size-[14px]" />
                Saved
              </Link>
            </Button>
            <Button variant="primary" size="md" asChild>
              <Link href="/submit" className="flex items-center gap-[6px]">
                <SquarePlus className="size-[14px]" />
                Submit a listing
              </Link>
            </Button>
          </div>
        </Card>
      </SectionShell>
    </div>
  );
}
