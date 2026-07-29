import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/layout/container";
import { JournalCard } from "@/components/journal/journal-card";
import { JOURNAL_POSTS, getJournalPost } from "@/content/journal";

export function generateStaticParams() {
  return JOURNAL_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getJournalPost(slug);
  if (!post) return {};
  return { title: `${post.title} — Crossing Journal`, description: post.dek };
}

export default async function JournalPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getJournalPost(slug);
  if (!post) notFound();
  const related = JOURNAL_POSTS.filter((item) => item.slug !== post.slug).slice(0, 2);

  return (
    <Container size="xl" className="product-page journal-detail-page">
      <Link className="journal-back" href="/journal"><ArrowLeft size={15} aria-hidden /> Journal</Link>
      <article className="journal-article">
        <header>
          <p className="product-eyebrow">{post.category} · Editorial preview</p>
          <h1>{post.title}</h1>
          <p className="journal-dek">{post.dek}</p>
          <div className="journal-byline">
            <span>{post.author}</span>
            <span>{new Date(post.published).toLocaleDateString("en", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" })}</span>
            <span>{post.readTime}</span>
          </div>
        </header>
        <div className="journal-prose">
          {post.body.map((section, index) => (
            <section key={section.heading ?? index}>
              {section.heading ? <h2>{section.heading}</h2> : null}
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </section>
          ))}
        </div>
      </article>

      <section className="journal-related" aria-labelledby="related-stories-title">
        <p className="product-eyebrow">Continue reading</p>
        <h2 id="related-stories-title">Related stories</h2>
        <div className="journal-grid">
          {related.map((item) => <JournalCard key={item.slug} post={item} />)}
        </div>
      </section>
    </Container>
  );
}
