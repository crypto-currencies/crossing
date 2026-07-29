-- CreateTable: append-only, versioned evidence snapshots (official-site ingestion).
-- Additive only — no existing table is modified or dropped.
CREATE TABLE "EvidenceSnapshot" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "adapterId" TEXT NOT NULL,
    "primarySourceUrl" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "httpStatus" INTEGER,
    "httpMeta" JSONB NOT NULL,
    "contentFingerprint" TEXT NOT NULL,
    "extractionVersion" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,
    "pricing" JSONB NOT NULL,
    "provenance" JSONB NOT NULL,
    "pages" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "freshnessStatus" TEXT NOT NULL,
    "warnings" JSONB NOT NULL,
    "errorKind" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceSnapshot_pkey" PRIMARY KEY ("id")
);

-- Dedup guard: an identical content fingerprint for an entity is never stored twice.
CREATE UNIQUE INDEX "EvidenceSnapshot_entityId_contentFingerprint_key" ON "EvidenceSnapshot"("entityId", "contentFingerprint");

-- CreateIndex
CREATE INDEX "EvidenceSnapshot_entityId_idx" ON "EvidenceSnapshot"("entityId");
CREATE INDEX "EvidenceSnapshot_adapterId_idx" ON "EvidenceSnapshot"("adapterId");
CREATE INDEX "EvidenceSnapshot_retrievedAt_idx" ON "EvidenceSnapshot"("retrievedAt" DESC);
CREATE INDEX "EvidenceSnapshot_contentFingerprint_idx" ON "EvidenceSnapshot"("contentFingerprint");
-- Latest-valid-snapshot lookup (entity + ok + newest first).
CREATE INDEX "EvidenceSnapshot_entityId_ok_retrievedAt_idx" ON "EvidenceSnapshot"("entityId", "ok", "retrievedAt" DESC);