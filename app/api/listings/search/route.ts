import { NextResponse } from "next/server";
import { DB_AVAILABLE } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { parsePageParams } from "@/lib/server/pagination";
import { searchListings } from "@/features/listings/search";
import { mapListingCard } from "@/features/listings/dto";

// ─── GET /api/listings/search?q=&category=&page=&pageSize= ───────────────────
// Public. Rate-limited per IP since search is the cheapest way to hammer the DB.

export async function GET(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ items: [], page: 1, pageSize: 20, total: 0 });
  }

  const ip = clientIp(request);
  if (!(await rateLimit(`search:${ip}`, 30, 60_000))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const category = searchParams.get("category")?.trim() || undefined;
  const page = parsePageParams(searchParams);

  const result = await searchListings({ q, categorySlug: category }, page);
  return NextResponse.json({ ...result, items: result.items.map(mapListingCard) });
}
