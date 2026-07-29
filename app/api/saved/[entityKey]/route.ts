import { toResponse, fromThrown } from "@/lib/server/api-result";
import { guardSavedRequest } from "@/features/saved/guard";
import { isSaved, unsaveEntity } from "@/features/saved/service";

// ─── /api/saved/[entityKey] ────────────────────────────────────────────────────
// GET    — is this entity saved by the caller?
// DELETE — unsave (idempotent: removing something already gone still succeeds)

export async function GET(request: Request, { params }: { params: Promise<{ entityKey: string }> }) {
  const guard = await guardSavedRequest(request);
  if (!guard.ok) return toResponse(guard);

  const { entityKey } = await params;
  try {
    return toResponse(await isSaved(guard.data.store, guard.data.userId, entityKey));
  } catch (err) {
    return toResponse(fromThrown(err, "saved.isSaved"));
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ entityKey: string }> }) {
  const guard = await guardSavedRequest(request, { mutation: true, bucket: "save" });
  if (!guard.ok) return toResponse(guard);

  const { entityKey } = await params;
  try {
    return toResponse(await unsaveEntity(guard.data.store, guard.data.userId, entityKey));
  } catch (err) {
    return toResponse(fromThrown(err, "saved.unsave"));
  }
}
