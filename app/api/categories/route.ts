import { NextResponse } from "next/server";
import { DB_AVAILABLE } from "@/lib/db";
import { listActiveCategories } from "@/features/categories/data";
import { mapCategory } from "@/features/categories/dto";

// ─── GET /api/categories ──────────────────────────────────────────────────────
// Public. Active categories in manual display order.

export async function GET() {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ categories: [] });
  }

  const categories = await listActiveCategories();
  return NextResponse.json({ categories: categories.map(mapCategory) });
}
