import { toResponse, fail, fromThrown, zodFields } from "@/lib/server/api-result";
import { guardSavedRequest, readJson } from "@/features/saved/guard";
import { listSaved, saveEntity, listQuerySchema, saveInputSchema } from "@/features/saved/service";

// ─── /api/saved ────────────────────────────────────────────────────────────────
// GET  — list the caller's saved items (paginated, optionally by collection)
// POST — save an entity (idempotent)
//
// Response envelope for both: { ok: true, data } | { ok: false, error }.
// A failed mutation never returns 200.

export async function GET(request: Request) {
  const guard = await guardSavedRequest(request);
  if (!guard.ok) return toResponse(guard);

  const url = new URL(request.url);
  const parsed = listQuerySchema.safeParse({
    limit: url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined,
    offset: url.searchParams.has("offset") ? Number(url.searchParams.get("offset")) : undefined,
    collectionId: url.searchParams.get("collectionId") ?? undefined,
  });
  if (!parsed.success) {
    return toResponse(fail("invalid_body", "Invalid query parameters.", zodFields(parsed.error)));
  }

  try {
    return toResponse(await listSaved(guard.data.store, guard.data.userId, parsed.data));
  } catch (err) {
    return toResponse(fromThrown(err, "saved.list"));
  }
}

export async function POST(request: Request) {
  const guard = await guardSavedRequest(request, { mutation: true, bucket: "save" });
  if (!guard.ok) return toResponse(guard);

  const body = await readJson(request);
  if (!body.ok) return toResponse(body);

  const parsed = saveInputSchema.safeParse(body.data);
  if (!parsed.success) {
    return toResponse(fail("invalid_body", "Invalid save request.", zodFields(parsed.error)));
  }

  try {
    // The service resolves idempotency: re-saving updates and reports created:false.
    return toResponse(await saveEntity(guard.data.store, guard.data.userId, parsed.data));
  } catch (err) {
    return toResponse(fromThrown(err, "saved.save"));
  }
}
