"use client";

import { useState } from "react";
import { BarChart3, Building2, FileCheck2, Megaphone, Receipt, ShieldCheck, Users } from "lucide-react";
import { ProductNotice } from "./product-primitives";

const VIEWS = [
  { id: "overview", label: "Overview", icon: Building2 },
  { id: "listing", label: "Listing editor", icon: FileCheck2 },
  { id: "evidence", label: "Evidence", icon: ShieldCheck },
  { id: "performance", label: "Performance", icon: BarChart3 },
  { id: "promotion", label: "Promotion", icon: Megaphone },
  { id: "billing", label: "Billing", icon: Receipt },
  { id: "team", label: "Team", icon: Users },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

const COPY: Record<ViewId, { title: string; body: string; state: string }> = {
  overview: {
    title: "Business workspace",
    body: "A single place to see listing status, review requested corrections, and understand what is ready for verification.",
    state: "Requires business ownership and permission contracts.",
  },
  listing: {
    title: "Keep listing facts current",
    body: "The editor will separate identity, description, location, hours, and structured attributes so corrections remain reviewable.",
    state: "Editing persistence is not connected.",
  },
  evidence: {
    title: "See what supports the listing",
    body: "Businesses will be able to review source freshness and flag evidence that no longer reflects the public product.",
    state: "Evidence disputes require a moderation contract.",
  },
  performance: {
    title: "Measure useful outcomes",
    body: "This area is reserved for real, privacy-reviewed metrics such as verified listing views and outbound visits.",
    state: "No production analytics are available, so no sample chart is shown.",
  },
  promotion: {
    title: "Promotion without hidden ranking influence",
    body: "Any paid placement must be visually distinct and must not alter organic recommendation scores.",
    state: "Promotion management is not connected.",
  },
  billing: {
    title: "Billing",
    body: "Plan, invoices, and payment controls will live here once a billing provider and approved plans exist.",
    state: "No checkout or payment provider is configured.",
  },
  team: {
    title: "Team members",
    body: "Owners will be able to invite collaborators and assign narrowly scoped listing-management access.",
    state: "Invites and business permissions are not connected.",
  },
};

export function BusinessWorkspacePreview() {
  const [view, setView] = useState<ViewId>("overview");
  const active = COPY[view];

  return (
    <div className="business-preview">
      <ProductNotice tone="warning" label="Frontend preview">
        <p>This workspace demonstrates information architecture only. It contains no production analytics, billing, ownership, or permissions.</p>
      </ProductNotice>
      <div className="business-preview-shell">
        <nav aria-label="Business workspace preview">
          {VIEWS.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" aria-current={view === item.id ? "page" : undefined} onClick={() => setView(item.id)}>
                <Icon size={16} aria-hidden /> {item.label}
              </button>
            );
          })}
        </nav>
        <section aria-live="polite">
          <p className="product-eyebrow">{VIEWS.find((item) => item.id === view)?.label}</p>
          <h2>{active.title}</h2>
          <p>{active.body}</p>
          <div className="business-preview-state">
            <strong>Availability</strong>
            <span>{active.state}</span>
          </div>
        </section>
      </div>
    </div>
  );
}
