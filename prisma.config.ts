import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Plain `dotenv` only auto-loads `.env` — it doesn't know about Next.js's
// `.env.local` convention, which is where DATABASE_URL actually lives for
// local dev (see .env.example). Load both explicitly, `.env.local` first
// since dotenv's config() never overrides a var that's already set.
config({ path: ".env.local" });
config();

// Falls back to a placeholder so `prisma generate` (schema-only, no DB
// connection) works in environments without DATABASE_URL set — e.g. a fresh
// checkout before a dev database is provisioned. Real commands that touch a
// database (`migrate`, `db push`, the app itself via lib/db.ts) require the
// real DATABASE_URL to be set.
process.env.DATABASE_URL ??= "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});