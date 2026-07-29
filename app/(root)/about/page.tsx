import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { PageHero } from "@/components/marketing/page-hero";

export const metadata: Metadata = {
  title: "About — Crossing",
  description: "What Crossing is, how it decides what to recommend, and what it can't do yet.",
};

export default function AboutPage() {
  return (
    <div>
      <PageHero
        eyebrow="About"
        title="What Crossing is"
        subtitle="One search bar for the decisions you'd otherwise spend an evening on."
      />

      <Container size="content" className="pb-24">
        <div className="legal-prose">
          <p>
            You describe what you need in your own words. Crossing works out what you actually
            asked for, compares the options against it, and shows you the best fit — along with
            the tradeoffs and the sources behind the answer.
          </p>

          <h2>How a recommendation is decided</h2>
          <p>
            Every option is compared against the same request. Crossing considers your must-haves,
            how directly each option addresses the need, what independent reviewers say, how current
            the information is, and whether the sources agree. Open any result to see the reasons,
            tradeoffs, and linked sources.
          </p>
          <p>
            If an option misses a required budget, feature, or platform, it stays out of the list
            rather than being quietly placed lower.
          </p>

          <h2>Where the information comes from</h2>
          <p>
            Facts like pricing, plans, and supported platforms are read from vendors&rsquo; own
            official websites, with the source URL and a supporting excerpt kept for every claim.
            We do not scrape review sites. When something can&rsquo;t be confirmed, it is recorded
            as unknown rather than guessed.
          </p>

          <h2>What Crossing can&rsquo;t do yet</h2>
          <p>
            Search currently covers software and online tools. Local businesses, physical products,
            and media aren&rsquo;t available yet, and Crossing will tell you so instead of
            recommending something unrelated. When current information is unavailable, the result
            says what is missing instead of filling the gap.
          </p>

          <h2>Honesty</h2>
          <p>
            Paid placement never changes recommendations — see our{" "}
            <Link href="/promotion-disclosure">promotion disclosure</Link>. If a result is thin or
            the sources disagree, the interface says that rather than projecting false certainty.
          </p>
        </div>
      </Container>
    </div>
  );
}
