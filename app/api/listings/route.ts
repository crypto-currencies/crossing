import { NextResponse } from "next/server";
import { DB_AVAILABLE } from "@/lib/db";
import { parsePageParams } from "@/lib/server/pagination";
import {
  listListingsByCategory,
  listNewestListings,
  listTrendingListings,
} from "@/features/listings/data";
import { mapListingCard } from "@/features/listings/dto";

// ─── GET /api/listings?category=&sort=trending|newest&page=&pageSize= ────────
// Public. Published listings only.

export async function GET(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ items: [], page: 1, pageSize: 20, total: 0 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category")?.trim() || undefined;
  const sort = searchParams.get("sort") === "newest" ? "newest" : "trending";
  const page = parsePageParams(searchParams);

  const result = category
    ? await listListingsByCategory(category, page, sort)
    : sort === "newest"
      ? await listNewestListings(page)
      : await listTrendingListings(page);

  return NextResponse.json({ ...result, items: result.items.map(mapListingCard) });
}
