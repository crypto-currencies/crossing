import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, Building2, FileCheck2, Scale, ShieldCheck, Users } from "lucide-react";
import { Container } from "@/components/layout/container";
import { BusinessWorkspacePreview } from "@/components/product/business-workspace-preview";
import { ProductHeader, ProductNotice } from "@/components/product/product-primitives";

export const metadata: Metadata = {
  title: "Crossing for Business",
  description: "A transparent foundation for claiming, correcting, and understanding a Crossing listing.",
};

const CAPABILITIES = [
  { icon: Building2, title: "Claim and manage", body: "Connect a verified representative to an existing listing once ownership contracts are available." },
  { icon: FileCheck2, title: "Correct information", body: "Propose factual changes without directly overwriting the evidence or moderation record." },
  { icon: ShieldCheck, title: "Review evidence", body: "See source freshness and report information that no longer represents the public offering." },
  { icon: BarChart3, title: "Understand performance", body: "View only real, privacy-reviewed metrics when analytics become available." },
  { icon: Scale, title: "Understand recommendations", body: "See how regular recommendations work and why payment cannot buy a better position." },
  { icon: Users, title: "Work as a team", body: "Invite collaborators with scoped permissions once business roles are implemented." },
] as const;

export default function BusinessPage() {
  return (
    <Container size="xl" className="product-page business-page">
      <ProductHeader
        eyebrow="Crossing for Business"
        title="Keep your listing accurate. Earn attention honestly."
        description="A future workspace for representatives who need to claim, correct, and understand a listing without obscuring how Crossing ranks recommendations."
        aside={
          <div className="business-header-actions">
            <Link className="product-primary-action" href="/register?intent=business">
              Business signup <ArrowRight size={16} aria-hidden />
            </Link>
            <Link href="/login?intent=business">Business login</Link>
          </div>
        }
      />

      <ProductNotice tone="warning" label="Foundation, not a live business product">
        <p>Business ownership, permissions, analytics, promotion, billing, and team access are backend dependencies. This page does not claim they are active.</p>
      </ProductNotice>

      <section className="product-section" aria-labelledby="business-capabilities-title">
        <div className="product-section-heading">
          <div>
            <p className="product-eyebrow">Product foundation</p>
            <h2 id="business-capabilities-title">What the workspace is designed to support</h2>
          </div>
        </div>
        <div className="business-capability-grid">
          {CAPABILITIES.map((capability) => {
            const Icon = capability.icon;
            return (
              <article key={capability.title}>
                <span aria-hidden><Icon size={20} /></span>
                <h3>{capability.title}</h3>
                <p>{capability.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="product-section" aria-labelledby="workspace-preview-title">
        <div className="product-section-heading">
          <div>
            <p className="product-eyebrow">Interactive architecture</p>
            <h2 id="workspace-preview-title">Preview the business workspace</h2>
          </div>
        </div>
        <BusinessWorkspacePreview />
      </section>

      <section className="business-ranking-callout">
        <div>
          <p className="product-eyebrow">Regular recommendations stay separate</p>
          <h2>Promotion should be visible, restrained, and never disguised as a winner.</h2>
        </div>
        <div>
          <p>Crossing’s public methodology explains the factors used in recommendations. Business tools may improve the accuracy of a listing; they do not purchase a higher organic score.</p>
          <Link href="/about">Read how Crossing works <ArrowRight size={15} aria-hidden /></Link>
        </div>
      </section>
    </Container>
  );
}
