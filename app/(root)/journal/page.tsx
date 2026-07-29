import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { JournalCard } from "@/components/journal/journal-card";
import { ProductHeader, ProductNotice } from "@/components/product/product-primitives";
import { JOURNAL_POSTS } from "@/content/journal";

export const metadata: Metadata = {
  title: "Journal — Crossing",
  description: "Editorial notes about recommendations, evidence, and the product Crossing is building.",
};

export default function JournalPage() {
  const featured = JOURNAL_POSTS.find((post) => post.featured) ?? JOURNAL_POSTS[0];
  const latest = JOURNAL_POSTS.filter((post) => post.slug !== featured.slug);

  return (
    <Container size="xl" className="product-page journal-page">
      <ProductHeader
        eyebrow="Crossing Journal"
        title="Notes on making better choices"
        description="Editorial writing is separate from regular recommendations. Stories explain the product and its methods; they do not affect result order."
      />
      <ProductNotice label="Editorial preview">
        <p>This preview shows how journal stories will appear once editorial publishing is available.</p>
      </ProductNotice>
      <section className="product-section" aria-labelledby="featured-story-title">
        <p className="product-eyebrow">Featured</p>
        <h2 id="featured-story-title" className="sr-only">Featured story</h2>
        <JournalCard post={featured} featured />
      </section>
      <section className="product-section" aria-labelledby="latest-stories-title">
        <div className="product-section-heading">
          <div>
            <p className="product-eyebrow">Latest</p>
            <h2 id="latest-stories-title">More from the journal</h2>
          </div>
        </div>
        <div className="journal-grid">
          {latest.map((post) => <JournalCard key={post.slug} post={post} />)}
        </div>
      </section>
    </Container>
  );
}
