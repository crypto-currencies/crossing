"use client";

import { Lock, Radio, Settings, ShieldCheck } from "lucide-react";
import { PageHeader, SectionShell } from "@/components/layout/surface";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageTransition } from "@/components/motion/page-transition";
import { useProductActions } from "@/components/product/product-modals";

interface RouteEmptyStateProps {
  title: string;
  description: string;
  state?: "locked" | "coming-soon" | "preview";
  primaryAction?: string;
  secondaryAction?: string;
}

export function RouteEmptyState({
  title,
  description,
  state = "coming-soon",
  primaryAction = "Continue",
  secondaryAction = "Back to dashboard",
}: RouteEmptyStateProps) {
  const { isAuthenticated, navigate, openLoginRequired, openComingSoon } = useProductActions();
  const locked = state === "locked" && !isAuthenticated;
  const Icon = locked ? Lock : state === "preview" ? Radio : state === "coming-soon" ? Settings : ShieldCheck;

  return (
    <PageTransition>
      <div className="page-stack">
        <SectionShell spacing="tight">
          <PageHeader title={title} description={description} />
        </SectionShell>
        <SectionShell spacing="default">
          <Card variant="default" padding="xl" className="max-w-[920px] stack-lg">
            <div className="flex items-start gap-[20px]">
              <span className="flex size-10 flex-shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--purple-soft)] bg-[var(--purple-soft)]">
                <Icon className="size-5 text-[var(--purple-strong)]" />
              </span>
              <div className="stack-sm min-w-0">
                <div className="cluster-sm">
                  <h1 className="t-heading">{locked ? "Login required" : title}</h1>
                  <Badge variant={locked ? "warning" : "outline"} size="xs">
                    {locked ? "Locked" : "Wired"}
                  </Badge>
                </div>
                <p className="t-body-sm text-[var(--text-soft)] max-w-[680px]">
                  {locked
                    ? "Guests can browse previews, but account workflows require a logged-in profile."
                    : "This route is connected and ready for the full workflow implementation."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-[12px]">
              <Button variant="ghost" size="md" onClick={() => navigate("/dashboard")}>
                {secondaryAction}
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  if (locked) openLoginRequired("Log in to access this product area.");
                  else openComingSoon(primaryAction);
                }}
              >
                {locked ? "Log in" : primaryAction}
              </Button>
            </div>
          </Card>
        </SectionShell>
      </div>
    </PageTransition>
  );
}
