# Auth architecture proposal — consumers vs. businesses

**Status: proposal only. Nothing here is implemented.** Requires approval of the
data model before any code is written. Crossing must not end up with two parallel
auth systems or two identity databases.

## Where we are today

One `User` model with a `role` enum (`USER | MODERATOR | ADMIN | OWNER`), one
sign-in path (Google OAuth + email/password), one session mechanism (a DB
`Session` row behind an httpOnly `session_token` cookie). There is no concept of
an organization, a business, or a claim on a listing. `OWNER_EMAIL` bootstraps
the platform owner to `OWNER` on first sign-in.

## Recommendation: shared identity, separate membership

**One person = one account, regardless of context.** A business relationship is
modeled as *membership in an organization*, not as a second kind of user.

Rationale:
- The same human is often both a consumer and a vendor employee. Separate
  accounts force a duplicate identity and a confusing double login.
- Google OAuth returns one identity per email; splitting on top of it invites
  account-collision bugs.
- Role/permission logic already keys off a single fresh DB read
  (`lib/server/admin.ts`), which extends cleanly to org membership.
- Avoids a second credential store — an explicit constraint.

### Proposed model (additive; no changes to `User` identity)

```prisma
model Organization {
  id         String   @id @default(cuid())
  name       String
  slug       String   @unique
  websiteUrlKey String? @unique   // normalized domain — links to a claimed Entity
  verifiedAt DateTime?            // domain ownership proven
  createdAt  DateTime @default(now())
  members    OrganizationMember[]
}

model OrganizationMember {
  id             String   @id @default(cuid())
  organizationId String
  userId         String
  role           OrgRole  @default(MEMBER)   // OWNER | ADMIN | MEMBER
  createdAt      DateTime @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([organizationId, userId])
  @@index([userId])
}
```

`User` gains only a back-relation. Platform `role` stays as-is — org roles are
**scoped**, platform roles are global; they must never be conflated.

## Sign-up / sign-in flows

- **Consumer:** unchanged. `/register` → Google or email/password → session → `/`.
- **Business:** the *same* login. The difference is what happens after: a
  `/business/start` flow creates an `Organization`, makes the creator its org
  `OWNER`, and begins verification. A user with ≥1 org membership sees a business
  entry point in the topbar; nobody is forced to choose an account type up front.

### Business verification (required before any listing control)

Domain ownership, proven by one of: a DNS TXT record, a file at a well-known path
on the claimed domain, or an email round-trip to an address at that domain.
Verification is what gates control of an entity — **never** self-declaration.
This reuses the ingestion approved-origin normalization
(`features/ingestion/url-policy.ts`).

### Business onboarding (after verification)

1. Claim the entity matching the verified domain.
2. Review the facts Crossing extracted from the official site, with provenance.
3. Submit corrections as *evidence*, which enter the same review pipeline — a
   vendor can never directly overwrite a ranking attribute.
4. Optional: paid placement, which by policy never affects ranking.

## Provider differences

None at the identity layer — same providers for everyone. Business-specific needs
(SSO/SAML, multiple seats, audit logs) are enterprise features layered on
`OrganizationMember`, not a separate auth system.

## Authorization rules

- Platform admin (`ADMIN`/`OWNER`) → `/control/*`. Unchanged.
- Org role → only that organization's resources. Never grants platform admin.
- A business user is an ordinary `USER` at the platform level. **Owning a
  business must never widen platform authorization.**

## Open questions for the owner

1. Can one organization claim multiple domains/products?
2. Do we need per-seat billing at launch, or is one org owner enough?
3. Should unverified organizations be visible at all, or fully hidden?
4. Does a paid plan ever change what a business can edit? (Recommendation: no.)

## Explicitly out of scope until approved

A second auth database, a separate `/business/login`, business-only session
cookies, or any flow where a business user gains elevated platform privileges.
