# Migration history

This migration history was generated **offline** (no live database was reachable
in the environment that created it — no `DATABASE_URL`, no local Postgres, no
Docker). Both files were produced with `prisma migrate diff --script`, which
computes SQL from the schema alone and needs no DB connection, but has
therefore **never been executed or verified against a real Postgres
instance**. Review the SQL before applying it.

## Why two migrations

- `20260710000000_baseline` — the schema as it stood before this task (User,
  Account, Session, Notification, AdminAuditLog, SecurityEvent,
  UserPreferences, PasswordResetToken). No migration file previously existed
  for it (this repo's migration history had been reset to empty during the
  earlier "foundation audit" commit, ahead of the actual tables it describes).
- `20260710000001_add_discovery_domain` — the actual new work: Category,
  Listing, Submission, Save, Vote, plus the new relation fields on `User`.

Splitting them means the migration that matters for this task
(`add_discovery_domain`) touches nothing but new tables — no risk to existing
User/Session/etc. data regardless of which scenario below applies.

## How to apply, depending on your dev database's actual state

**If your dev database is empty** (fresh Neon branch, fresh local Postgres):

```
npx prisma migrate dev
```

Applies both migrations in order; end state matches `schema.prisma`.

**If your dev database already has the User/Session/etc. tables** (the
likely case — this app has been running against some dev DB already, just
without tracked migration files):

```
npx prisma migrate resolve --applied 20260710000000_baseline
npx prisma migrate deploy
```

The first command tells Prisma "this migration's effects already exist,
don't run its SQL" — verify that assumption first (`\dt` in psql, or compare
against `prisma db pull` output) since if your live schema has actually
drifted from `baseline`'s SQL, marking it applied without checking will hide
that drift. The second command then only runs `add_discovery_domain`, which
is the one that has to execute for real.

Either way, run `npx prisma generate` afterward if you haven't already
(also runs automatically via the `postinstall` script).
