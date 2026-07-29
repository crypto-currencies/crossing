import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, FolderSearch, Sparkles } from "lucide-react";
import type { Category, ListingCard as Listing } from "@/types";
import { cn } from "@/lib/utils";

export function ProductHeader({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <header className="product-header">
      <div>
        <p className="product-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {aside ? <div className="product-header-aside">{aside}</div> : null}
    </header>
  );
}

export function ProductNotice({
  tone = "neutral",
  label,
  children,
}: {
  tone?: "neutral" | "positive" | "warning" | "error";
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("product-notice", `product-notice-${tone}`)}>
      {label ? <strong>{label}</strong> : null}
      <div>{children}</div>
    </div>
  );
}

export function ProductEmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body: string;
  action?: { label: string; href: string };
  icon?: ReactNode;
}) {
  return (
    <section className="product-empty" aria-labelledby={`empty-${title.replace(/\s+/g, "-").toLowerCase()}`}>
      <div className="product-empty-icon" aria-hidden>
        {icon ?? <FolderSearch size={24} />}
      </div>
      <h2 id={`empty-${title.replace(/\s+/g, "-").toLowerCase()}`}>{title}</h2>
      <p>{body}</p>
      {action ? (
        <Link href={action.href}>
          {action.label} <ArrowRight size={16} aria-hidden />
        </Link>
      ) : null}
    </section>
  );
}

export function ListingResultCard({ listing, compact = false }: { listing: Listing; compact?: boolean }) {
  return (
    <article className={cn("catalog-listing-card", compact && "catalog-listing-card-compact")}>
      <div className="catalog-listing-mark" aria-hidden>
        {listing.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.logoUrl} alt="" />
        ) : (
          listing.name.slice(0, 1).toUpperCase()
        )}
      </div>
      <div className="catalog-listing-copy">
        <div className="catalog-listing-meta">
          <span>{listing.category.name}</span>
          <span>{new Date(listing.publishedAt).toLocaleDateString("en", { month: "short", year: "numeric" })}</span>
        </div>
        <h3>{listing.name}</h3>
        <p>{listing.tagline}</p>
        <div className="catalog-listing-actions">
          <Link href={`/listing/${listing.slug}`}>
            View details <ArrowRight size={14} aria-hidden />
          </Link>
          <a href={listing.websiteUrl} target="_blank" rel="noreferrer">
            Website <ExternalLink size={13} aria-hidden />
          </a>
        </div>
      </div>
    </article>
  );
}

export function CategoryContractCard({ category }: { category: Category | { id: string; name: string; description?: string | null } }) {
  return (
    <Link className="catalog-category-card" href={`/browse/${category.id}`}>
      <span className="catalog-category-icon" aria-hidden>
        <Sparkles size={18} />
      </span>
      <span>
        <strong>{category.name}</strong>
        <small>{category.description || "Explore options and compare the evidence."}</small>
      </span>
      <ArrowRight size={16} aria-hidden />
    </Link>
  );
}
