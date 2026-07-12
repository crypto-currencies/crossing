import { NextResponse } from "next/server";
import { DB_AVAILABLE } from "@/lib/db";
import { requireAuth } from "@/lib/server/auth";
import { parsePageParams } from "@/lib/server/pagination";
import { listSavedListings } from "@/features/saves/data";
import { mapListingCard } from "@/features/listings/dto";

// ─── GET /api/me/saves ──────────────────────────────────────────────────────
// Authenticated. Current user's saved listings only — never another user's.

export async function GET(request: Request) {
  if (!DB_AVAILABLE) return NextResponse.json({ items: [], page: 1, pageSize: 20, total: 0 });

  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = parsePageParams(searchParams);

  const result = await listSavedListings(user.id, page);
  return NextResponse.json({ ...result, items: result.items.map(mapListingCard) });
}
