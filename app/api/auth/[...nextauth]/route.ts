/**
 * NextAuth route — handles Google OAuth sign-in.
 *
 * Security model
 * ──────────────
 * NextAuth v4 with strategy:"jwt" encrypts the JWT using JWE (AES-256-CBC /
 * HMAC-SHA-512) when NEXTAUTH_SECRET is set. That means the payload is opaque
 * to clients — they only ever see the encrypted cookie.
 *
 * We deliberately do NOT store our custom DB session token inside the JWT.
 * Putting a long-lived, database-backed credential inside any token — even an
 * encrypted one — creates an unnecessary attack surface: JWT compromise →
 * immediate DB session access without a database call.
 *
 * Instead, the JWT stores only stable identity fields (userId, name). The DB
 * session is created on-demand in /api/auth/google-token the first time the
 * client reaches the /oauth-callback bridge page.
 */

import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db, DB_AVAILABLE } from "@/lib/db";

// ── Startup guard ─────────────────────────────────────────────────────────────
// NEXTAUTH_SECRET is required for JWE encryption of the session JWT and for
// HMAC signing of OAuth state tokens. Fail loudly at boot rather than silently
// degrading to unsigned / unencrypted tokens.
if (!process.env.NEXTAUTH_SECRET) {
  throw new Error(
    "NEXTAUTH_SECRET environment variable is not set.\n" +
      "Generate a strong secret with:  openssl rand -base64 32\n" +
      "Then add it to .env.local and your Vercel environment variables.",
  );
}

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days — matches custom DB session TTL
  },

  // Required. Encrypts the JWT with AES-256-CBC + HMAC-SHA-512 (JWE).
  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    /**
     * Runs on every sign-in and JWT refresh.
     * `account` is only present on the initial OAuth sign-in — we use that
     * to upsert the DB user and store stable identity fields in the JWT.
     *
     * We do NOT create or store a DB session token here. The DB session is
     * issued by /api/auth/google-token when the client exchanges the NextAuth
     * JWT for a Bearer token during the /oauth-callback flow.
     */
    async jwt({ token, account, profile }) {
      if (account && profile && DB_AVAILABLE) {
        try {
          const email = token.email ?? (profile as { email?: string }).email ?? null;
          const name = (profile as { name?: string }).name ?? token.name ?? "";
          const image = (profile as { picture?: string }).picture ?? null;

          let dbUser = email ? await db.user.findFirst({ where: { email } }) : null;

          // Also check by provider account ID in case the user has no email
          // or changed their email on the provider side.
          if (!dbUser) {
            const linked = await db.account.findUnique({
              where: {
                provider_providerAccountId: {
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                },
              },
              include: { user: true },
            });
            dbUser = linked?.user ?? null;
          }

          const isNewUser = !dbUser;

          if (!dbUser) {
            dbUser = await db.user.create({
              data: {
                email: email ?? undefined,
                name: name || null,
                image,
              },
            });
          } else if (!dbUser.image && image) {
            // Keep avatar up to date if not already set
            dbUser = await db.user.update({
              where: { id: dbUser.id },
              data: { image },
            });
          }

          // Keep the NextAuth Account link up to date (for useSession provider info)
          await db.account.upsert({
            where: {
              provider_providerAccountId: {
                provider: account.provider,
                providerAccountId: account.providerAccountId,
              },
            },
            create: {
              userId: dbUser.id,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              access_token: account.access_token ?? null,
              refresh_token: account.refresh_token ?? null,
              expires_at: account.expires_at ?? null,
            },
            update: {
              access_token: account.access_token ?? null,
              refresh_token: account.refresh_token ?? null,
              expires_at: account.expires_at ?? null,
            },
          });

          // Store identity fields only — no DB session token in the JWT.
          // The Bearer token is issued separately by /api/auth/google-token.
          token.userId = dbUser.id;
          token.name = dbUser.name;
          token.isNewUser = isNewUser;
        } catch (err) {
          // Re-throw so NextAuth redirects to /login?error=user_create_failed
          // rather than silently returning a token with no userId that fails
          // at the bridge with a generic "oauth_failed" message.
          console.error("[NextAuth] OAuth user setup failed — aborting sign-in:", err);
          throw new Error("user_create_failed");
        }
      }
      return token;
    },

    async session({ session, token }) {
      // Expose DB user fields so useSession() callers get id / name.
      // Note: customToken is intentionally omitted — it is never part of the
      // NextAuth session object. Clients get the Bearer token from
      // /api/auth/google-token at oauth-callback time and store it locally.
      if (session.user) {
        (session.user as Record<string, unknown>).id = token.userId;
        (session.user as Record<string, unknown>).name = token.name;
      }
      (session as unknown as Record<string, unknown>).isNewUser = token.isNewUser;
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
});

export { handler as GET, handler as POST };
