import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { DB_AVAILABLE } from "@/lib/db";
import { requireAuth, isSuspended } from "@/lib/server/auth";
import {
  storageConfigured,
  validateProfileAsset,
  uploadProfileAsset,
  StorageNotConfiguredError,
  ASSET_CONSTRAINTS,
  type AssetType,
} from "@/lib/server/storage";

// Multipart orchestration and legacy buffered uploads both need generous time.
export const maxDuration = 60;

const VALID_TYPES: readonly AssetType[] = [
  "avatar",
  "banner",
  "background",
  "music",
  "musicArtwork",
  "collectionCover",
];

// ─── GET /api/upload — storage capability probe ───────────────────────────────

export async function GET() {
  const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
  const isDev = process.env.NODE_ENV === "development";
  return NextResponse.json({
    configured: hasBlob || isDev,
    // "client" = direct-to-Blob upload (production)
    // "local"  = server-buffered local filesystem (development only)
    mode: hasBlob ? "client" : isDev ? "local" : "unconfigured",
  });
}

// ─── POST /api/upload ─────────────────────────────────────────────────────────
//
// Two request shapes are accepted:
//
//   application/json { assetType, fileName }
//     → validates auth, issues a signed Vercel Blob client token.
//       The browser uploads the file DIRECTLY to Vercel Blob CDN,
//       bypassing the 4.5 MB serverless function body limit entirely.
//       Progress is tracked natively via the upload() XHR.
//
//   multipart/form-data { file, type }
//     → legacy server-buffered path. Only reachable in local development
//       when BLOB_READ_WRITE_TOKEN is not set (GET returns mode:"local").

export async function POST(request: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  const ct = request.headers.get("content-type") ?? "";

  if (ct.includes("application/json")) {
    return handleTokenRequest(request);
  }

  return handleLegacyUpload(request);
}

// ─── Client-token issuance (production path) ──────────────────────────────────

async function handleTokenRequest(request: Request): Promise<NextResponse> {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isSuspended(user)) return NextResponse.json({ error: "suspended" }, { status: 403 });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "storage_not_configured" }, { status: 503 });
  }

  let body: { assetType?: unknown; fileName?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const assetType = typeof body.assetType === "string" ? body.assetType : "";
  if (!(VALID_TYPES as string[]).includes(assetType)) {
    return NextResponse.json(
      { error: `invalid assetType — must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  const rawName = typeof body.fileName === "string" ? body.fileName : "upload.bin";
  const ext = (rawName.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const pathname = `profiles/${user.id}/${assetType}/${randomUUID()}.${ext}`;

  const c = ASSET_CONSTRAINTS[assetType as AssetType];
  // For background assets the video cap (25 MB) is used as the upper bound;
  // fine-grained MIME-level size enforcement happens client-side before upload.
  const maxBytes = assetType === "background" && c.videoMaxMB
    ? c.videoMaxMB * 1024 * 1024
    : c.maxMB * 1024 * 1024;

  try {
    const { generateClientTokenFromReadWriteToken } = await import("@vercel/blob/client");
    const clientToken = await generateClientTokenFromReadWriteToken({
      token: process.env.BLOB_READ_WRITE_TOKEN,
      pathname,
      maximumSizeInBytes: maxBytes,
      allowedContentTypes: [...c.mimes] as string[],
      addRandomSuffix: false,
    });

    return NextResponse.json({ clientToken, pathname });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[upload/token] Failed to generate client token:", message);
    return NextResponse.json({ error: "token_generation_failed", detail: message }, { status: 500 });
  }
}

// ─── Legacy server-buffered upload (local development only) ──────────────────

async function handleLegacyUpload(request: Request): Promise<NextResponse> {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isSuspended(user)) return NextResponse.json({ error: "suspended" }, { status: 403 });

  if (!storageConfigured()) {
    return NextResponse.json({ error: "storage_not_configured" }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const type = formData.get("type") as string | null;

  if (!file || !type || !(VALID_TYPES as string[]).includes(type)) {
    return NextResponse.json(
      { error: `missing or invalid fields: file, type (one of: ${VALID_TYPES.join(", ")})` },
      { status: 400 },
    );
  }

  const validationError = validateProfileAsset(file.type, file.size, type as AssetType);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 422 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await uploadProfileAsset(
      user.id,
      buffer,
      file.name,
      file.type,
      type as AssetType,
    );
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) {
      return NextResponse.json({ error: "storage_not_configured" }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[upload/legacy] error:", message, err instanceof Error ? err.stack : "");
    return NextResponse.json({ error: "upload_failed", detail: message }, { status: 500 });
  }
}
