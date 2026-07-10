"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Upload, X, Image, RotateCcw, Music2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  validateMediaFile,
  uploadMediaWithProgress,
  formatFileSize,
  type MediaType,
  MEDIA_CONSTRAINTS,
} from "@/lib/media";

// ─── Storage capability check ─────────────────────────────────────────────────

async function checkStorageConfigured(): Promise<boolean> {
  try {
    const res = await fetch("/api/upload");
    if (!res.ok) return false;
    const { configured } = await res.json() as { configured: boolean };
    return configured;
  } catch {
    return false;
  }
}

function useStorageStatus() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    checkStorageConfigured().then(setConfigured);
  }, []);
  return configured;
}

// ─── Upload state ─────────────────────────────────────────────────────────────

type UploadState = "idle" | "uploading" | "done" | "error";

// ─── Avatar picker ────────────────────────────────────────────────────────────

interface AvatarPickerProps {
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  onRemove: () => void;
  className?: string;
  /** Called when an upload begins — use to disable a parent Save button. */
  onUploadStart?: () => void;
  /** Called when an upload finishes (success or error). */
  onUploadEnd?: () => void;
}

export function AvatarPicker({
  currentUrl,
  onUploaded,
  onRemove,
  className,
  onUploadStart,
  onUploadEnd,
}: AvatarPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const configured = useStorageStatus();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);

  function pick() {
    if (!configured) return;
    setError(null);
    inputRef.current?.click();
  }

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const err = validateMediaFile(file, "avatar");
    if (err) { setError(err); return; }

    setError(null);
    setUploadState("uploading");
    setProgress(0);
    onUploadStart?.();
    try {
      const url = await uploadMediaWithProgress(file, "avatar", setProgress);
      setUploadState("done");
      onUploaded(url);
    } catch (e) {
      setUploadState("error");
      setError((e as Error).message || "Upload failed. Please try again.");
    } finally {
      onUploadEnd?.();
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void handleFiles(e.dataTransfer.files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const constraints = MEDIA_CONSTRAINTS.avatar;
  const isUploading = uploadState === "uploading";
  const disabled = configured === false;

  return (
    <div className={cn("flex flex-col items-center gap-[10px]", className)}>
      <div
        className={cn(
          "relative group size-[96px] rounded-full border-2 transition-all",
          disabled
            ? "opacity-50 cursor-not-allowed border-[var(--border)]"
            : isUploading
            ? "border-[var(--purple)] cursor-wait"
            : dragging
            ? "border-[var(--purple)] scale-105 cursor-pointer"
            : "border-[var(--border)] hover:border-[var(--border-strong)] cursor-pointer"
        )}
        onClick={disabled || isUploading ? undefined : pick}
        onDragOver={(e) => { if (!disabled && !isUploading) { e.preventDefault(); setDragging(true); } }}
        onDragLeave={() => setDragging(false)}
        onDrop={disabled || isUploading ? undefined : onDrop}
      >
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt="Avatar preview"
            className="size-full rounded-full object-cover"
          />
        ) : (
          <div className="size-full rounded-full bg-[var(--panel-2)] flex items-center justify-center">
            <Image className="size-8 text-[var(--muted)]" />
          </div>
        )}

        {/* Upload progress overlay */}
        {isUploading && (
          <div className="absolute inset-0 rounded-full bg-black/65 flex flex-col items-center justify-center">
            <Loader2 className="size-5 text-white animate-spin mb-[3px]" />
            <span className="text-[9px] font-bold text-white">{progress}%</span>
          </div>
        )}

        {/* Hover overlay */}
        {!isUploading && !disabled && (
          <div className="absolute inset-0 rounded-full bg-black/55 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Upload className="size-5 text-white mb-[3px]" />
            <span className="text-[10px] font-bold text-white uppercase tracking-wide">
              {currentUrl ? "Change" : "Upload"}
            </span>
          </div>
        )}

        {currentUrl && !isUploading && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute -top-[6px] -right-[6px] size-6 rounded-full bg-[var(--panel)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--danger)] transition-colors shadow-md"
            title="Remove avatar"
            aria-label="Remove avatar"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      {disabled ? (
        <p className="t-caption text-center text-[var(--muted)] flex items-center gap-[4px]">
          <AlertCircle className="size-3 flex-shrink-0" />
          Storage not configured
        </p>
      ) : (
        <p className="t-caption text-center text-[var(--muted)]">
          {constraints.recommendedDimensions} · max {constraints.maxSizeMB}MB
        </p>
      )}

      {error && (
        <p className="t-caption text-[var(--danger)] text-center">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={constraints.allowedTypes.join(",")}
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
    </div>
  );
}

// ─── Banner / background picker ───────────────────────────────────────────────

interface MediaPickerProps {
  type: "banner" | "background" | "collectionCover";
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  onRemove: () => void;
  className?: string;
  /** Called when an upload begins — use to disable a parent Save button. */
  onUploadStart?: () => void;
  /** Called when an upload finishes (success or error). */
  onUploadEnd?: () => void;
}

export function MediaPicker({
  type,
  currentUrl,
  onUploaded,
  onRemove,
  className,
  onUploadStart,
  onUploadEnd,
}: MediaPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const configured = useStorageStatus();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);

  const constraints = MEDIA_CONSTRAINTS[type];
  const isUploading = uploadState === "uploading";
  const disabled = configured === false;

  function pick() {
    if (disabled || isUploading) return;
    setError(null);
    inputRef.current?.click();
  }

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const err = validateMediaFile(file, type);
    if (err) { setError(err); return; }

    setError(null);
    setUploadState("uploading");
    setProgress(0);
    onUploadStart?.();
    try {
      const url = await uploadMediaWithProgress(file, type, setProgress);
      setUploadState("done");
      onUploaded(url);
    } catch (e) {
      setUploadState("error");
      setError((e as Error).message || "Upload failed. Please try again.");
    } finally {
      onUploadEnd?.();
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void handleFiles(e.dataTransfer.files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn("stack-xs", className)}>
      <div
        onClick={disabled || isUploading ? undefined : pick}
        onDragOver={(e) => { if (!disabled && !isUploading) { e.preventDefault(); setDragging(true); } }}
        onDragLeave={() => setDragging(false)}
        onDrop={disabled || isUploading ? undefined : onDrop}
        className={cn(
          "relative group w-full overflow-hidden rounded-[var(--radius-lg)] border-2 transition-all",
          type === "banner" ? "h-[90px]" : "h-[72px]",
          disabled
            ? "opacity-50 cursor-not-allowed border-[var(--border)]"
            : isUploading
            ? "border-[var(--purple)] cursor-wait"
            : dragging
            ? "border-[var(--purple)] scale-[1.01] cursor-pointer"
            : "border-[var(--border)] hover:border-[var(--border-strong)] cursor-pointer"
        )}
      >
        {currentUrl ? (
          <>
            {/* Show video preview for mp4/webm, image otherwise */}
            {/\.(mp4|webm)(\?|$)/i.test(currentUrl) ? (
              <video
                src={currentUrl}
                className="size-full object-cover"
                muted
                loop
                playsInline
                autoPlay
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentUrl}
                alt={`${type} preview`}
                className="size-full object-cover"
              />
            )}
            {/* Hover replace overlay */}
            {!isUploading && !disabled && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-[6px] text-white">
                  <Upload className="size-4" />
                  <span className="text-[11px] font-bold uppercase tracking-wide">Replace</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="size-full bg-[var(--panel-2)] flex flex-col items-center justify-center gap-[6px]">
            <Upload className="size-5 text-[var(--muted)]" />
            <p className="t-caption text-[var(--muted)]">
              {disabled ? "Storage not configured" : `Click or drag to upload ${type}`}
            </p>
          </div>
        )}

        {/* Upload progress overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-black/65 flex flex-col items-center justify-center gap-[6px]">
            <Loader2 className="size-5 text-white animate-spin" />
            <div className="w-[80px] h-[3px] rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-white transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[9px] font-bold text-white">{progress}%</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        {disabled ? (
          <p className="t-caption text-[var(--muted)] flex items-center gap-[4px]">
            <AlertCircle className="size-3 flex-shrink-0" />
            Configure storage to enable uploads
          </p>
        ) : (
          <p className="t-caption text-[var(--muted)]">
            {constraints.recommendedDimensions} · max {constraints.maxSizeMB}MB
          </p>
        )}
        {currentUrl && !isUploading && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="flex items-center gap-[4px] t-caption text-[var(--muted)] hover:text-[var(--danger)] transition-colors"
          >
            <RotateCcw className="size-3" />
            Reset
          </button>
        )}
      </div>

      {error && (
        <p className="t-caption text-[var(--danger)]">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={constraints.allowedTypes.join(",")}
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
    </div>
  );
}

// ─── Music file picker ────────────────────────────────────────────────────────

interface MusicFilePickerProps {
  currentUrl: string | null;
  onUploaded: (url: string, fileName: string) => void;
  onRemove: () => void;
  className?: string;
}

export function MusicFilePicker({
  currentUrl,
  onUploaded,
  onRemove,
  className,
}: MusicFilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const configured = useStorageStatus();
  const [error, setError] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);

  const constraints = MEDIA_CONSTRAINTS.music;
  const isUploading = uploadState === "uploading";
  const disabled = configured === false;

  function pick() {
    if (disabled || isUploading) return;
    setError(null);
    inputRef.current?.click();
  }

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const err = validateMediaFile(file, "music");
    if (err) { setError(err); return; }

    setError(null);
    setUploadState("uploading");
    setProgress(0);
    setFileName(file.name);
    try {
      const url = await uploadMediaWithProgress(file, "music", setProgress);
      setUploadState("done");
      onUploaded(url, file.name);
    } catch (e) {
      setUploadState("error");
      setFileName(null);
      setError((e as Error).message || "Upload failed. Please try again.");
    }
  }

  const displayName = fileName ?? (currentUrl ? currentUrl.split("/").pop() ?? "Audio file" : null);

  return (
    <div className={cn("stack-xs", className)}>
      {currentUrl && !isUploading ? (
        /* Current file display */
        <div className="flex items-center gap-[10px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-2)] px-[10px] py-[8px]">
          <div className="flex size-[32px] flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--panel-3)]">
            <Music2 className="size-[14px] text-[var(--muted)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[var(--text)] truncate">{displayName}</p>
            <p className="text-[9px] text-[var(--muted)]">Uploaded audio file</p>
          </div>
          <div className="flex items-center gap-[6px] flex-shrink-0">
            <button
              type="button"
              onClick={pick}
              className="text-[10px] text-[var(--muted)] hover:text-[var(--text-soft)] transition-colors"
              title="Replace audio file"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="text-[var(--muted)] hover:text-[var(--danger)] transition-colors"
              title="Remove audio"
              aria-label="Remove audio"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      ) : isUploading ? (
        /* Progress display */
        <div className="flex items-center gap-[10px] rounded-[var(--radius-md)] border border-[var(--purple)]/40 bg-[var(--panel-2)] px-[10px] py-[8px]">
          <Loader2 className="size-[16px] text-[var(--purple)] animate-spin flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-[var(--text)] truncate">{displayName}</p>
            <div className="mt-[4px] h-[2px] rounded-full bg-[var(--panel-3)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--purple)] transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <span className="text-[10px] text-[var(--muted)] flex-shrink-0">{progress}%</span>
        </div>
      ) : (
        /* Upload dropzone */
        <button
          type="button"
          onClick={pick}
          disabled={disabled}
          className={cn(
            "flex w-full items-center gap-[10px] rounded-[var(--radius-md)] border-2 border-dashed px-[12px] py-[10px] transition-all text-left",
            disabled
              ? "opacity-50 cursor-not-allowed border-[var(--border)]"
              : "border-[var(--border)] hover:border-[var(--border-strong)] cursor-pointer"
          )}
        >
          <div className="flex size-[32px] flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--panel-2)]">
            <Music2 className="size-[14px] text-[var(--muted)]" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-[var(--text)]">
              {disabled ? "Storage not configured" : "Choose audio file"}
            </p>
            <p className="text-[9px] text-[var(--muted)]">
              {disabled
                ? "Set BLOB_READ_WRITE_TOKEN to enable uploads"
                : `${constraints.recommendedDimensions} · max ${constraints.maxSizeMB}MB`}
            </p>
          </div>
          {!disabled && <Upload className="size-4 text-[var(--muted)] ml-auto flex-shrink-0" />}
        </button>
      )}

      {error && (
        <p className="t-caption text-[var(--danger)]">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={constraints.allowedTypes.join(",")}
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
    </div>
  );
}
