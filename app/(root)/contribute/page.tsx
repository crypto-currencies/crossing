import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FilePenLine, FolderPlus, Link2Off, MessageSquareWarning, PlusCircle, RefreshCw } from "lucide-react";
import { Container } from "@/components/layout/container";
import { ProductHeader, ProductNotice } from "@/components/product/product-primitives";

export const metadata: Metadata = {
  title: "Contribute — Crossing",
  description: "Understand the contribution types Crossing supports now and the intake contracts still in development.",
};

const CONTRIBUTION_TYPES = [
  {
    icon: PlusCircle,
    title: "Suggest a missing listing",
    body: "Send a name, website, category, summary, and description to the existing moderation queue.",
    status: "Available for signed-in users",
    href: "/submit",
    active: true,
  },
  {
    icon: FilePenLine,
    title: "Correct listing information",
    body: "Propose a factual correction while preserving a moderator-visible audit trail.",
    status: "Correction contract needed",
  },
  {
    icon: RefreshCw,
    title: "Report outdated evidence",
    body: "Point to a claim or source that no longer reflects the current product.",
    status: "Evidence-report contract needed",
  },
  {
    icon: FolderPlus,
    title: "Propose a category",
    body: "Suggest a new area only after its comparable attributes and evidence standards are defined.",
    status: "Category-proposal contract needed",
  },
  {
    icon: MessageSquareWarning,
    title: "Business-owner submission",
    body: "Begin with a normal listing suggestion; ownership and claim verification are not active yet.",
    status: "Business verification needed",
    href: "/business",
  },
  {
    icon: Link2Off,
    title: "Report a broken destination",
    body: "Flag a listing whose public destination is unavailable or materially changed.",
    status: "Issue-report contract needed",
  },
] as const;

export default function ContributePage() {
  return (
    <Container size="xl" className="product-page">
      <ProductHeader
        eyebrow="Contribute"
        title="Help Crossing keep the useful things useful"
        description="Contribution starts with a clear intake type, visible moderation, and no suggestion of success before the server confirms it."
      />
      <ProductNotice label="One live intake contract">
        <p>The listing-submission flow is connected now. Correction, evidence, issue, and category proposals remain designed unavailable states until backend contracts exist.</p>
      </ProductNotice>
      <section className="product-section" aria-labelledby="contribution-types-title">
        <div className="product-section-heading">
          <div>
            <p className="product-eyebrow">Choose the right path</p>
            <h2 id="contribution-types-title">Contribution types</h2>
          </div>
        </div>
        <div className="contribution-grid">
          {CONTRIBUTION_TYPES.map((item) => {
            const Icon = item.icon;
            const content = (
              <>
                <span className="contribution-icon" aria-hidden><Icon size={20} /></span>
                <span className="contribution-status">{item.status}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                {"href" in item && item.href ? <strong>{"active" in item && item.active ? "Open flow" : "Learn more"} <ArrowRight size={14} aria-hidden /></strong> : null}
              </>
            );
            return "href" in item && item.href
              ? <Link key={item.title} href={item.href} className={"active" in item && item.active ? "active" : ""}>{content}</Link>
              : <article key={item.title}>{content}</article>;
          })}
        </div>
      </section>
    </Container>
  );
}
