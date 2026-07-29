import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { JournalPost } from "@/content/journal";
import { cn } from "@/lib/utils";

export function JournalCard({ post, featured = false }: { post: JournalPost; featured?: boolean }) {
  return (
    <article className={cn("journal-card", featured && "journal-card-featured")}>
      <div className="journal-card-meta">
        <span>{post.category}</span>
        <span>{new Date(post.published).toLocaleDateString("en", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })}</span>
        <span>{post.readTime}</span>
      </div>
      <h2>{post.title}</h2>
      <p>{post.dek}</p>
      <Link href={`/journal/${post.slug}`}>
        Read story <ArrowRight size={15} aria-hidden />
      </Link>
    </article>
  );
}
