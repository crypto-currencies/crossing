import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SearchExperience } from "@/components/search/search-experience";

export const metadata: Metadata = {
  title: "Search — Crossing",
  description: "Describe what you need and compare researched options with pricing, reviews, sources, and tradeoffs.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const raw = params.q;
  const initialQuery = (Array.isArray(raw) ? raw[0] : raw ?? "").slice(0, 300);

  // A bare `/search` (no query) duplicated the homepage hero with an idle input.
  // Send it to the canonical homepage search instead. A query is always rendered
  // here — the homepage search submits to /search?q=…, so redirecting that case
  // would create an infinite loop.
  if (!initialQuery.trim()) {
    redirect("/#search");
  }

  return <SearchExperience initialQuery={initialQuery} />;
}
