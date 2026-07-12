import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var __prisma: PrismaClient | undefined;
}

/** True when DATABASE_URL is configured and the DB client is available */
export const DB_AVAILABLE = !!process.env.DATABASE_URL;

let _client: PrismaClient | undefined;

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function getClient(): PrismaClient {
  if (_client) return _client;
  _client = globalThis.__prisma ?? createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalThis.__prisma = _client;
  }
  return _client;
}

// Lazy proxy — PrismaClient is only instantiated when first accessed,
// so importing this module during build (without DATABASE_URL) is safe.
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_, prop: string | symbol) {
    return Reflect.get(getClient(), prop);
  },
});
