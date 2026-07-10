import { NextResponse } from "next/server";
import { DB_AVAILABLE } from "@/lib/db";

export async function GET() {
  const status = DB_AVAILABLE ? "ok" : "degraded";
  return NextResponse.json({ status }, { status: DB_AVAILABLE ? 200 : 503 });
}
