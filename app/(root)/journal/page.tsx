import { PageTransition, Reveal } from "@/components/motion";
import { PageHero } from "@/components/marketing/page-hero";
import { Container } from "@/components/layout/container";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const POSTS = [
  { title: "How ranking actually works", tag: "Product", date: "Jun 2026" },
  { title: "Why we don't sell placement", tag: "Product", date: "May 2026" },
  { title: "Crossing is now in three new cities", tag: "Update", date: "Apr 2026" },
];

export default function JournalPage() {
  return (
    <PageTransition>
      <PageHero eyebrow="Journal" title="Notes from the team" subtitle="What we're building and why." />

      <Container size="content" className="pb-24">
        <Reveal className="flex flex-col gap-1">
          {POSTS.map((post) => (
            <Card key={post.title} shape="row">
              <div className="flex items-center gap-3">
                <span className="t-body-sm text-[var(--text-primary)]">{post.title}</span>
                <Badge variant="outline">{post.tag}</Badge>
              </div>
              <span className="t-caption">{post.date}</span>
            </Card>
          ))}
        </Reveal>
      </Container>
    </PageTransition>
  );
}
