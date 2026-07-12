/**
 * Idempotent dev-database seed for Crossing.dev's discovery domain.
 * Safe to run repeatedly — every row is created via upsert on a stable
 * natural key (category slug, listing slug, user email), so re-running
 * updates existing rows in place instead of duplicating them.
 *
 * Run with: npx tsx prisma/seed.ts  (or `npx prisma db seed`)
 *
 * Marking seed data: every listing/submission here is attributed to one of
 * two clearly-synthetic accounts (see SEED_USERS below) rather than a real
 * user — that attribution is the marker. There's no `isSeed` column on
 * Listing; adding one purely to flag dev fixtures would be schema bloat for
 * a fact that's already visible via `submittedBy.email` ending in
 * `@seed.crossing.dev`. Real listings will be submitted by real users and
 * never carry that email domain.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../lib/server/auth";
import { slugify } from "../lib/server/slug";
import { normalizeUrlKey } from "../lib/server/url-normalize";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

// ─── Seed identity ──────────────────────────────────────────────────────────
// Two synthetic accounts, never real users. SEED_DEMO_USER has a known local
// dev password so you can log in and exercise save/vote/submit as a real
// authenticated user without creating a throwaway account by hand.

const SEED_ATTRIBUTION_USER = {
  email: "attribution@seed.crossing.dev",
  name: "Seed Data",
};

const SEED_DEMO_USER = {
  email: "demo@seed.crossing.dev",
  name: "Seed Demo User",
  password: "seed-demo-password-do-not-use-in-prod",
};

// ─── Categories ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  { slug: "software", name: "Software", description: "Apps and tools for getting work done.", icon: "AppWindow" },
  { slug: "ai-tools", name: "AI Tools", description: "Models, assistants, and AI-powered utilities.", icon: "Sparkles" },
  { slug: "websites", name: "Websites", description: "Useful web-based tools and references.", icon: "Globe" },
  { slug: "communities", name: "Communities", description: "Forums and spaces worth joining.", icon: "Users" },
  { slug: "games", name: "Games", description: "Games worth your time.", icon: "Gamepad2" },
  { slug: "services", name: "Services", description: "Hosted platforms and infrastructure.", icon: "Server" },
  { slug: "creators", name: "Creators", description: "People making things worth following.", icon: "Video" },
  { slug: "products", name: "Products", description: "Standalone products that don't fit elsewhere.", icon: "Package" },
] as const;

// ─── Listings ───────────────────────────────────────────────────────────────
// Real, recognizable products — not "Example Tool" placeholders — with
// original tagline/description text written for this seed, not scraped or
// copied from the products' own marketing. `daysAgo` staggers publishedAt so
// newest/trending sorts have something real to demonstrate; `votes`/`saves`/
// `views` give the ranking formula non-trivial input.

interface SeedListing {
  category: (typeof CATEGORIES)[number]["slug"];
  name: string;
  tagline: string;
  description: string;
  websiteUrl: string;
  daysAgo: number;
  votes: number;
  saves: number;
  views: number;
}

const LISTINGS: SeedListing[] = [
  // software
  { category: "software", name: "Linear", tagline: "Issue tracking that doesn't get in your way.", description: "A fast, keyboard-driven project tracker built for software teams who want planning to feel as quick as writing code.", websiteUrl: "https://linear.app", daysAgo: 3, votes: 84, saves: 51, views: 2400 },
  { category: "software", name: "Notion", tagline: "Docs, wikis, and project boards in one workspace.", description: "A flexible workspace that blends notes, databases, and light project management so a team can keep most of its knowledge in one place.", websiteUrl: "https://www.notion.so", daysAgo: 40, votes: 132, saves: 98, views: 6100 },
  { category: "software", name: "Figma", tagline: "Interface design that runs in the browser.", description: "Collaborative interface design software with real-time multiplayer editing, component systems, and developer handoff built in.", websiteUrl: "https://www.figma.com", daysAgo: 60, votes: 156, saves: 110, views: 8300 },
  { category: "software", name: "Raycast", tagline: "A faster way to do almost everything on your Mac.", description: "A command-line-style launcher that replaces Spotlight with a fast, extensible palette for app switching, snippets, and scripted workflows.", websiteUrl: "https://www.raycast.com", daysAgo: 12, votes: 61, saves: 44, views: 1800 },
  { category: "software", name: "Obsidian", tagline: "A local-first knowledge base built on plain text files.", description: "A note-taking app that stores everything as linked Markdown files on disk, with a graph view for seeing how your notes connect.", websiteUrl: "https://obsidian.md", daysAgo: 20, votes: 73, saves: 66, views: 2900 },

  // ai-tools
  { category: "ai-tools", name: "Perplexity", tagline: "An answer engine that cites its sources.", description: "A search-and-answer tool that responds to questions in plain language and links back to the sources it drew on, instead of just a list of links.", websiteUrl: "https://www.perplexity.ai", daysAgo: 5, votes: 91, saves: 58, views: 3600 },
  { category: "ai-tools", name: "Cursor", tagline: "A code editor built around an AI pair programmer.", description: "A fork of VS Code with AI editing, chat, and codebase-aware autocomplete built directly into the editing experience rather than bolted on as a plugin.", websiteUrl: "https://www.cursor.com", daysAgo: 2, votes: 108, saves: 77, views: 4200 },
  { category: "ai-tools", name: "ElevenLabs", tagline: "Realistic text-to-speech and voice cloning.", description: "A voice AI platform for generating natural-sounding speech in many languages, including custom cloned voices for narration and dubbing.", websiteUrl: "https://elevenlabs.io", daysAgo: 25, votes: 47, saves: 39, views: 2100 },
  { category: "ai-tools", name: "Runway", tagline: "AI video generation and editing tools.", description: "A suite of generative video tools for text-to-video, video editing, and visual effects aimed at filmmakers and motion designers.", websiteUrl: "https://runwayml.com", daysAgo: 15, votes: 55, saves: 41, views: 2500 },

  // websites
  { category: "websites", name: "Excalidraw", tagline: "A virtual whiteboard with a hand-drawn look.", description: "A free, open-source sketching tool for diagrams and quick wireframes, with a distinctive hand-drawn rendering style and easy sharing.", websiteUrl: "https://excalidraw.com", daysAgo: 8, votes: 66, saves: 52, views: 2200 },
  { category: "websites", name: "Carrd", tagline: "One-page sites, built fast.", description: "A simple builder for single-page sites — landing pages, personal profiles, and small project pages — with no code required.", websiteUrl: "https://carrd.co", daysAgo: 45, votes: 38, saves: 30, views: 1500 },
  { category: "websites", name: "Can I Use", tagline: "Browser support tables for web platform features.", description: "A reference site for checking which browsers support a given HTML, CSS, or JavaScript feature before you rely on it in production.", websiteUrl: "https://caniuse.com", daysAgo: 90, votes: 29, saves: 22, views: 3100 },
  { category: "websites", name: "Regex101", tagline: "Build and test regular expressions with live explanations.", description: "An interactive regex tester that highlights matches as you type and explains each part of the pattern in plain language.", websiteUrl: "https://regex101.com", daysAgo: 70, votes: 34, saves: 27, views: 2700 },

  // communities
  { category: "communities", name: "Hacker News", tagline: "Tech news and discussion, ranked by upvotes.", description: "A link-sharing and discussion board for programming, startups, and technology, run by Y Combinator since 2007.", websiteUrl: "https://news.ycombinator.com", daysAgo: 100, votes: 71, saves: 40, views: 5200 },
  { category: "communities", name: "Indie Hackers", tagline: "A community for people building profitable side projects.", description: "A forum and podcast where founders share revenue numbers, growth tactics, and the day-to-day reality of running small, independent businesses.", websiteUrl: "https://www.indiehackers.com", daysAgo: 35, votes: 42, saves: 33, views: 1900 },
  { category: "communities", name: "dev.to", tagline: "A community of software developers writing and sharing.", description: "A blogging platform and community built specifically for developers, with tags for nearly every language and framework.", websiteUrl: "https://dev.to", daysAgo: 55, votes: 36, saves: 25, views: 2000 },

  // games
  { category: "games", name: "Balatro", tagline: "A poker-inspired roguelike deckbuilder.", description: "A roguelike deckbuilder built around poker hands, where escalating joker combinations turn simple hands into absurd scoring chains.", websiteUrl: "https://www.playbalatro.com", daysAgo: 18, votes: 97, saves: 60, views: 3400 },
  { category: "games", name: "Slay the Spire", tagline: "The deckbuilder that defined the genre.", description: "A card-based roguelike where you climb a procedurally generated tower, building a deck and relic combination as you go.", websiteUrl: "https://www.megacrit.com", daysAgo: 200, votes: 85, saves: 48, views: 4100 },
  { category: "games", name: "Celeste", tagline: "A precision platformer about climbing a mountain.", description: "A tightly-designed platformer about a young woman climbing a mountain, praised for its level design, soundtrack, and accessibility options.", websiteUrl: "https://www.celestegame.com", daysAgo: 150, votes: 64, saves: 35, views: 2600 },

  // services
  { category: "services", name: "Stripe", tagline: "Payments infrastructure for the internet.", description: "A developer-first platform for accepting payments, managing subscriptions, and handling the financial plumbing behind an online business.", websiteUrl: "https://stripe.com", daysAgo: 30, votes: 58, saves: 30, views: 3800 },
  { category: "services", name: "Vercel", tagline: "Deploy frontend apps without touching infrastructure.", description: "A hosting platform built around frontend frameworks, with automatic preview deployments and a generous free tier for side projects.", websiteUrl: "https://vercel.com", daysAgo: 10, votes: 79, saves: 55, views: 3300 },
  { category: "services", name: "Resend", tagline: "Email sending built for developers.", description: "A transactional email API with a clean developer experience, React-based email templates, and straightforward deliverability tooling.", websiteUrl: "https://resend.com", daysAgo: 22, votes: 33, saves: 21, views: 1400 },
  { category: "services", name: "Cal.com", tagline: "Open-source scheduling infrastructure.", description: "A self-hostable, API-first alternative to Calendly for booking meetings, with white-labeling and workflow automation built in.", websiteUrl: "https://cal.com", daysAgo: 48, votes: 27, saves: 18, views: 1200 },

  // creators
  { category: "creators", name: "Kurzgesagt", tagline: "Animated science explainers, beautifully made.", description: "A studio making short, densely-researched animated videos on science and philosophy topics, known for its distinctive visual style.", websiteUrl: "https://kurzgesagt.org", daysAgo: 65, votes: 49, saves: 28, views: 3900 },
  { category: "creators", name: "The Pudding", tagline: "Visual essays that explain ideas with data.", description: "A digital publication that explains cultural and data-driven topics through interactive visual essays instead of plain text articles.", websiteUrl: "https://pudding.cool", daysAgo: 80, votes: 31, saves: 19, views: 1700 },
  { category: "creators", name: "Every", tagline: "Essays and tools for people who think about the future of work.", description: "A media company publishing daily essays on technology, productivity, and AI, alongside a small suite of internal tools it builds and sells.", websiteUrl: "https://every.to", daysAgo: 14, votes: 24, saves: 16, views: 1100 },

  // products
  { category: "products", name: "Arc", tagline: "A browser redesigned around how people actually browse.", description: "A browser that rethinks tabs, sidebars, and split views from scratch, aimed at people who keep dozens of tabs open at once.", websiteUrl: "https://arc.net", daysAgo: 6, votes: 88, saves: 61, views: 3700 },
  { category: "products", name: "reMarkable", tagline: "A paper-like tablet for writing and reading.", description: "An E Ink tablet built specifically for handwriting and reading documents, designed to feel closer to paper than a typical tablet.", websiteUrl: "https://remarkable.com", daysAgo: 110, votes: 41, saves: 24, views: 2300 },
];

// ─── Pending / rejected submissions ─────────────────────────────────────────
// Demonstrates the moderation queue end to end — these are what an admin
// sees at GET /api/admin/submissions and act on via approve/reject.

const DEMO_SUBMISSIONS = [
  {
    category: "software" as const,
    name: "Zed",
    tagline: "A GPU-accelerated code editor built for speed and collaboration.",
    description: "Zed is a multiplayer code editor written in Rust, built around low-latency rendering and real-time collaborative editing.",
    websiteUrl: "https://zed.dev",
  },
  {
    category: "ai-tools" as const,
    name: "Ideogram",
    tagline: "An image generator that's unusually good at rendering text.",
    description: "A text-to-image model that handles legible text inside generated images far more reliably than most competitors, useful for posters and logos.",
    websiteUrl: "https://ideogram.ai",
  },
];

const DEMO_REJECTED_SUBMISSION = {
  category: "products" as const,
  name: "Generic Widget Pro",
  tagline: "The best widget for all your widget needs.",
  description: "This is a placeholder-quality submission included in the seed to demonstrate what a rejected submission with a moderator note looks like in the admin queue.",
  websiteUrl: "https://example.com/generic-widget",
  moderatorNote: "Reads as spam/placeholder content — no concrete product info. Resubmit with real details if this is a genuine listing.",
};

async function main() {
  console.log("Seeding Crossing.dev discovery domain (idempotent)...\n");

  // ── Seed identity ──
  const attributionUser = await db.user.upsert({
    where: { email: SEED_ATTRIBUTION_USER.email },
    update: {},
    create: {
      email: SEED_ATTRIBUTION_USER.email,
      name: SEED_ATTRIBUTION_USER.name,
      verified: true,
      onboardingCompleted: true,
    },
  });

  const demoUser = await db.user.upsert({
    where: { email: SEED_DEMO_USER.email },
    update: {},
    create: {
      email: SEED_DEMO_USER.email,
      name: SEED_DEMO_USER.name,
      verified: true,
      onboardingCompleted: true,
      passwordHash: hashPassword(SEED_DEMO_USER.password),
    },
  });
  console.log(`  users: ${SEED_ATTRIBUTION_USER.email}, ${SEED_DEMO_USER.email} (password: "${SEED_DEMO_USER.password}")`);

  // ── Categories ──
  const categoryIdBySlug = new Map<string, string>();
  for (const [i, c] of CATEGORIES.entries()) {
    const category = await db.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description, icon: c.icon, position: i },
      create: { slug: c.slug, name: c.name, description: c.description, icon: c.icon, position: i, isActive: true },
    });
    categoryIdBySlug.set(c.slug, category.id);
  }
  console.log(`  categories: ${CATEGORIES.length}`);

  // ── Listings ──
  const now = Date.now();
  const listingIdBySlug = new Map<string, string>();
  for (const l of LISTINGS) {
    const slug = slugify(l.name);
    const publishedAt = new Date(now - l.daysAgo * 86_400_000);
    const listing = await db.listing.upsert({
      where: { slug },
      update: {
        tagline: l.tagline,
        description: l.description,
        websiteUrl: l.websiteUrl,
        websiteUrlKey: normalizeUrlKey(l.websiteUrl),
        categoryId: categoryIdBySlug.get(l.category)!,
        saveCount: l.saves,
        voteCount: l.votes,
        viewCount: l.views,
      },
      create: {
        name: l.name,
        slug,
        tagline: l.tagline,
        description: l.description,
        websiteUrl: l.websiteUrl,
        websiteUrlKey: normalizeUrlKey(l.websiteUrl),
        categoryId: categoryIdBySlug.get(l.category)!,
        submittedById: attributionUser.id,
        approvedById: attributionUser.id,
        approvedAt: publishedAt,
        publishedAt,
        status: "PUBLISHED",
        saveCount: l.saves,
        voteCount: l.votes,
        viewCount: l.views,
      },
    });
    listingIdBySlug.set(slug, listing.id);
  }
  console.log(`  listings: ${LISTINGS.length}`);

  // ── Ranking scores, computed from the seeded counters ──
  const { recomputeRankingScores } = await import("../features/listings/ranking");
  const { updated } = await recomputeRankingScores();
  console.log(`  ranking scores recomputed: ${updated} listings`);

  // ── A few Save/Vote rows from the demo user, so /api/me/saves has data ──
  const demoUserSaves = ["linear", "figma", "balatro"];
  const demoUserVotes = ["cursor", "arc", "obsidian"];
  for (const slug of demoUserSaves) {
    const listingId = listingIdBySlug.get(slug);
    if (!listingId) continue;
    await db.save.upsert({
      where: { userId_listingId: { userId: demoUser.id, listingId } },
      update: {},
      create: { userId: demoUser.id, listingId },
    });
  }
  for (const slug of demoUserVotes) {
    const listingId = listingIdBySlug.get(slug);
    if (!listingId) continue;
    await db.vote.upsert({
      where: { userId_listingId: { userId: demoUser.id, listingId } },
      update: {},
      create: { userId: demoUser.id, listingId },
    });
  }
  console.log(`  demo saves/votes: ${demoUserSaves.length}/${demoUserVotes.length}`);

  // ── Pending submissions (moderation queue demo data) ──
  for (const s of DEMO_SUBMISSIONS) {
    const websiteUrlKey = normalizeUrlKey(s.websiteUrl);
    const existing = await db.submission.findFirst({
      where: { submittedById: demoUser.id, websiteUrlKey, status: "PENDING" },
    });
    if (existing) continue;
    await db.submission.create({
      data: {
        name: s.name,
        tagline: s.tagline,
        description: s.description,
        websiteUrl: s.websiteUrl,
        websiteUrlKey,
        categoryId: categoryIdBySlug.get(s.category)!,
        submittedById: demoUser.id,
        status: "PENDING",
      },
    });
  }

  // ── One rejected submission, with a moderator note ──
  {
    const s = DEMO_REJECTED_SUBMISSION;
    const websiteUrlKey = normalizeUrlKey(s.websiteUrl);
    const existing = await db.submission.findFirst({
      where: { submittedById: demoUser.id, websiteUrlKey },
    });
    if (!existing) {
      await db.submission.create({
        data: {
          name: s.name,
          tagline: s.tagline,
          description: s.description,
          websiteUrl: s.websiteUrl,
          websiteUrlKey,
          categoryId: categoryIdBySlug.get(s.category)!,
          submittedById: demoUser.id,
          status: "REJECTED",
          moderatorNote: s.moderatorNote,
          reviewedById: attributionUser.id,
          reviewedAt: new Date(),
        },
      });
    }
  }
  console.log(`  submissions: ${DEMO_SUBMISSIONS.length} pending, 1 rejected\n`);

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
