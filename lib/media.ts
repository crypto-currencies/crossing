/**
 * Client-side media utilities.
 *
 * In production (BLOB_READ_WRITE_TOKEN set): the browser obtains a signed
 * client token from /api/upload and uploads the file DIRECTLY to Vercel Blob
 * CDN. This bypasses the 4.5 MB serverless function body limit and supports
 * files up to 30 MB with native progress tracking and multipart chunking.
 *
 * In development (no Blob token): falls back to server-buffered XHR upload
 * to the local filesystem via /api/upload (multipart/form-data).
 *
 * Size limits and MIME allowlists here must stay in sync with
 * lib/server/storage.ts (ASSET_CONSTRAINTS). The server is authoritative —
 * these are for early client-side feedback only.
 */

export type MediaType =
  | "avatar"
  | "banner"
  | "background"
  | "music"
  | "musicArtwork"
  | "collectionCover";

export interface MediaConstraints {
  maxSizeMB: number;
  /** For background only: higher limit that applies to video files. */
  videoMaxSizeMB?: number;
  allowedTypes: readonly string[];
  recommendedDimensions: string;
}

export const MEDIA_CONSTRAINTS: Record<MediaType, MediaConstraints> = {
  avatar: {
    maxSizeMB: 5,
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    recommendedDimensions: "400×400px",
  },
  banner: {
    maxSizeMB: 10,
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    recommendedDimensions: "1200×400px",
  },
  background: {
    maxSizeMB: 10,
    videoMaxSizeMB: 25,
    allowedTypes: [
      "image/jpeg", "image/png", "image/webp",
      "image/gif",
      "video/mp4", "video/webm",
    ],
    recommendedDimensions: "1440×900px · image/GIF ≤10 MB · MP4/WebM ≤25 MB",
  },
  music: {
    maxSizeMB: 30,
    allowedTypes: [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/wave",
      "audio/ogg",
      "audio/mp4",
      "audio/x-m4a",
      "audio/m4a",
      "audio/aac",
    ],
    recommendedDimensions: "MP3, WAV, OGG, M4A",
  },
  musicArtwork: {
    maxSizeMB: 5,
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    recommendedDimensions: "500×500px",
  },
  collectionCover: {
    maxSizeMB: 10,
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    recommendedDimensions: "800×800px",
  },
};

/** Returns an error string, or null if valid. */
export function validateMediaFile(file: File, type: MediaType): string | null {
  const { maxSizeMB, videoMaxSizeMB, allowedTypes } = MEDIA_CONSTRAINTS[type];
  const isAudio = type === "music";

  const strictMatch = (allowedTypes as string[]).includes(file.type);
  // Audio: allow loose audio/* fallback for obscure browser-reported variants
  const looseMatch = isAudio && (allowedTypes as string[]).some(
    (t) => file.type.startsWith(t.split("/")[0] + "/")
  );
  const mimeOk = strictMatch || looseMatch;

  if (!mimeOk) {
    const names = isAudio
      ? "MP3, WAV, OGG, M4A, AAC"
      : [...new Set((allowedTypes as string[]).map((t) => t.split("/")[1].toUpperCase()))].join(", ");
    return `Unsupported format. Allowed: ${names}`;
  }

  const isVideo = file.type.startsWith("video/");
  const effectiveMaxMB =
    type === "background" && isVideo && videoMaxSizeMB
      ? videoMaxSizeMB
      : maxSizeMB;

  if (file.size > effectiveMaxMB * 1024 * 1024) {
    return `File too large — max ${effectiveMaxMB}MB (yours: ${(file.size / 1024 / 1024).toFixed(1)}MB)`;
  }

  return null;
}

// ─── Upload mode detection ────────────────────────────────────────────────────
// Cached per page-load — avoids a probe request on every upload attempt.

type UploadMode = "client" | "local" | "unconfigured";
let _cachedMode: UploadMode | null = null;

async function getUploadMode(): Promise<UploadMode> {
  if (_cachedMode) return _cachedMode;
  try {
    const res = await fetch("/api/upload");
    if (!res.ok) { _cachedMode = "unconfigured"; return _cachedMode; }
    const data = await res.json() as { configured?: boolean; mode?: string };
    _cachedMode = (data.mode as UploadMode | undefined) ?? (data.configured ? "client" : "unconfigured");
  } catch {
    _cachedMode = "unconfigured";
  }
  return _cachedMode;
}

// ─── Client-side direct-to-Blob upload (production) ──────────────────────────

async function uploadToBlob(
  file: File,
  type: MediaType,
  onProgress?: (pct: number) => void,
): Promise<string> {
  // Step 1: Get a signed upload token from the server.
  //         Only JSON metadata is sent — no file bytes go through the function.
  const tokenRes = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetType: type, fileName: file.name }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.json().catch(() => ({})) as { error?: string; detail?: string };
    throw new Error(friendlyError(body.error, body.detail));
  }

  const { clientToken, pathname } = await tokenRes.json() as {
    clientToken: string;
    pathname: string;
  };

  // Step 2: Upload directly to Vercel Blob CDN using the signed token.
  //         `put()` is the correct client-token API; `upload()` uses handleUploadUrl.
  //         multipart splits files >5 MB into parallel chunks with automatic retry.
  //         Note: put() calls https://vercel.com/api/blob/ — that host must be in
  //         CSP connect-src or the request is silently blocked in production.
  const { put } = await import("@vercel/blob/client");
  try {
    const blob = await put(pathname, file, {
      access: "public",
      token: clientToken,
      multipart: file.size > 5 * 1024 * 1024,
      onUploadProgress: onProgress
        ? ({ percentage }) => onProgress(Math.min(Math.round(percentage), 100))
        : undefined,
    });
    return blob.url;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Surface the SDK error with enough context to debug without leaking internals.
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("Load failed")) {
      throw new Error("Upload blocked — possible CSP or network issue. Try refreshing.");
    }
    throw new Error(`Upload failed: ${msg}`);
  }
}

// ─── Server-buffered XHR upload (local development fallback) ─────────────────

function uploadViaXhr(
  file: File,
  type: MediaType,
  onProgress?: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);

    const xhr = new XMLHttpRequest();

    if (onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const { url } = JSON.parse(xhr.responseText) as { url: string };
          resolve(url);
        } catch {
          reject(new Error("Upload succeeded but the server returned an unreadable response."));
        }
      } else {
        try {
          const { error, detail } = JSON.parse(xhr.responseText) as { error?: string; detail?: string };
          reject(new Error(friendlyError(error, detail)));
        } catch {
          reject(new Error("Upload failed. Please try again."));
        }
      }
    });

    xhr.addEventListener("error", () =>
      reject(new Error("Network error — check your connection and try again."))
    );
    xhr.addEventListener("abort", () =>
      reject(new Error("Upload was cancelled."))
    );

    xhr.open("POST", "/api/upload");
    xhr.send(form);
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Upload a media file to the configured storage provider and return its public URL.
 * Uses direct Vercel Blob upload in production (no 4.5 MB body limit).
 * Throws with a user-facing error message on failure — never throws a raw HTTP error.
 */
export async function uploadMedia(file: File, type: MediaType): Promise<string> {
  const mode = await getUploadMode();
  if (mode === "unconfigured") throw new Error("File storage is not configured. Contact support.");
  return mode === "client" ? uploadToBlob(file, type) : uploadViaXhr(file, type);
}

/**
 * Upload a media file with 0–100 progress callbacks.
 * Uses direct Vercel Blob upload in production (no 4.5 MB body limit).
 * Throws with a user-facing error message on failure.
 */
export async function uploadMediaWithProgress(
  file: File,
  type: MediaType,
  onProgress: (pct: number) => void,
): Promise<string> {
  const mode = await getUploadMode();
  if (mode === "unconfigured") throw new Error("File storage is not configured. Contact support.");
  return mode === "client" ? uploadToBlob(file, type, onProgress) : uploadViaXhr(file, type, onProgress);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function friendlyError(code?: string, detail?: string): string {
  switch (code) {
    case "unauthorized":            return "Please sign in and try again.";
    case "suspended":               return "Your account is suspended.";
    case "storage_not_configured":  return "File storage is not configured. Contact support.";
    case "token_generation_failed": return "Could not prepare the upload. Please try again.";
    case "invalid_form_data":       return "The file could not be read. Please try again.";
    default:
      if (detail?.toLowerCase().includes("too large"))    return detail;
      if (detail?.toLowerCase().includes("content type")) return "That file type is not allowed.";
      return "Upload failed. Please try again.";
  }
}

export function isObjectUrl(url: string): boolean {
  return url.startsWith("blob:");
}

/** Call when done with a previewed object URL to free memory. */
export function revokeMediaUrl(url: string) {
  if (isObjectUrl(url)) URL.revokeObjectURL(url);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
