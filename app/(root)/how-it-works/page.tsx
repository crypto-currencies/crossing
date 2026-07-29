import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Braces, FileSearch, ListChecks, Search } from "lucide-react";
import { Container } from "@/components/layout/container";
import { ProductHeader, ProductNotice } from "@/components/product/product-primitives";

export const metadata: Metadata = {
  title: "How Crossing works",
  description: "From a natural-language request to researched options with visible sources and tradeoffs.",
};

const STEPS = [
  { icon: Search, title: "Describe the decision", body: "Write what you need, including the budget, platform, audience, or other details that matter." },
  { icon: Braces, title: "Separate needs from preferences", body: "Crossing keeps must-haves separate from the qualities that would simply make an option better." },
  { icon: ListChecks, title: "Compare the strongest matches", body: "Options that miss a must-have stay out. The rest are ordered by how well they answer the full request." },
  { icon: FileSearch, title: "Show the reasons", body: "Every result keeps its strengths, tradeoffs, source dates, and missing information in view." },
] as const;

export default function HowItWorksPage() {
  return (
    <Container size="xl" className="product-page">
      <ProductHeader
        eyebrow="How Crossing works"
        title="From a question to a recommendation you can inspect"
        description="Crossing turns an ordinary-language request into a researched shortlist and shows what supports each option."
      />
      <ProductNotice label="Current coverage">
        <p>Search currently covers software and online tools. Local places, physical products, and services will clearly say when recommendations are not available yet.</p>
      </ProductNotice>
      <section className="product-section">
        <div className="method-steps">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <article key={step.title}>
                <span className="method-step-number">0{index + 1}</span>
                <Icon size={21} aria-hidden />
                <h2>{step.title}</h2>
                <p>{step.body}</p>
              </article>
            );
          })}
        </div>
      </section>
      <section className="business-ranking-callout">
        <div>
          <p className="product-eyebrow">Go deeper</p>
          <h2>A recommendation is useful only when the reasons are visible.</h2>
        </div>
        <div>
          <p>Different decisions call for different priorities. Crossing considers your must-haves, overall quality, current information, independent sources, and important drawbacks.</p>
          <Link href="/ranking-methodology">See how recommendations are ordered <ArrowRight size={15} aria-hidden /></Link>
        </div>
      </section>
    </Container>
  );
}
