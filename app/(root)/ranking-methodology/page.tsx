import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { ProductHeader, ProductNotice } from "@/components/product/product-primitives";

export const metadata: Metadata = {
  title: "How recommendations are ordered — Crossing",
  description: "The information Crossing uses to compare options and show what remains uncertain.",
};

const FACTORS = [
  ["Your must-haves", "Whether an option meets the requirements you said were non-negotiable."],
  ["Relevance to your request", "How directly the option addresses the need you described."],
  ["Overall quality", "What reliable product information and independent reviews say about the option."],
  ["Review support", "Whether a quality claim is backed by enough independent experience to be useful."],
  ["Variety of sources", "Whether more than one kind of independent source supports the same conclusion."],
  ["How current it is", "Whether the available information is recent enough for this kind of decision."],
  ["Important caveats", "Whether missing information or well-supported drawbacks should change the recommendation."],
] as const;

export default function RankingMethodologyPage() {
  return (
    <Container size="content" className="product-page">
      <ProductHeader
        eyebrow="How recommendations are ordered"
        title="The best match depends on what you asked for"
        description="Crossing compares every option against the same request, then shows the sources and tradeoffs behind the order."
      />
      <ProductNotice tone="warning" label="A useful guide, not a guarantee">
        <p>A recommendation reflects the information available for one request. It is not professional advice or a promise that an option will suit everyone.</p>
      </ProductNotice>
      <div className="methodology-list">
        {FACTORS.map(([title, body], index) => (
          <section key={title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h2>{title}</h2>
              <p>{body}</p>
            </div>
          </section>
        ))}
      </div>
      <div className="legal-prose methodology-prose">
        <h2>Required details come first</h2>
        <p>An option that misses a required feature, platform, or budget stays out rather than quietly appearing lower in the list.</p>
        <h2>Priorities depend on the decision</h2>
        <p>Fast-changing AI tools need especially current information, while hosting decisions may put more weight on reliability and known drawbacks. Crossing does not use one generic leaderboard for every search.</p>
        <h2>Missing information remains visible</h2>
        <p>Unknown details, few independent sources, and older information are called out where they matter. The interface does not fill those gaps with invented facts.</p>
        <h2>Payment is separate</h2>
        <p>Promotion does not change the order of recommendations. Any future paid placement must be labeled and visually separated from the regular results.</p>
      </div>
    </Container>
  );
}
