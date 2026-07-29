export type Priority = "overall" | "value" | "easy" | "trusted";

export type Result = {
  id: string;
  name: string;
  meta: string;
  score: string;
  verdict: string;
  note: string;
  caveat: string;
  tags: string[];
  image: string;
  facts: [string, string][];
};

export type SearchSet = {
  label: string;
  query: string;
  count: string;
  sourceLine: string;
  intent: string[];
  sources: [string, string][];
  priorityPicks: Record<Priority, string>;
  results: Result[];
};

export const PRIORITIES: { id: Priority; label: string }[] = [
  { id: "overall", label: "Best overall" },
  { id: "value", label: "Best value" },
  { id: "easy", label: "Easiest" },
  { id: "trusted", label: "Most trusted" },
];

export const SEARCH_SETS: SearchSet[] = [
  {
    label: "Places",
    query: "quiet coffee shop with outlets near me",
    count: "12 places",
    sourceLine: "184 reviews · 8 local lists · 23 discussions",
    intent: ["quiet", "outlets", "nearby"],
    sources: [["Recent reviews", "184"], ["Local lists", "8"], ["Discussions", "23"]],
    priorityPicks: { overall: "marigold", value: "frame", easy: "frame", trusted: "marigold" },
    results: [
      {
        id: "marigold",
        name: "Marigold Coffee",
        meta: "0.4 mi · Nob Hill",
        score: "9.3",
        verdict: "Best fit",
        note: "Long tables, outlets at every bench, and the room stays calm after the morning rush.",
        caveat: "It gets busy before 10 and closes earlier than Frame.",
        tags: ["quiet after 10", "many outlets", "good light"],
        image: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=85",
        facts: [["Walk", "8 min"], ["Noise", "Low"], ["Typical stay", "2.1 hr"]],
      },
      {
        id: "frame",
        name: "Frame Coffee",
        meta: "0.7 mi · Downtown",
        score: "8.8",
        verdict: "Roomiest",
        note: "The most seating of the group, with strong wifi and easy weekday parking.",
        caveat: "The room is louder around lunch and the coffee is less consistent.",
        tags: ["spacious", "fast wifi", "parking"],
        image: "https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1200&q=85",
        facts: [["Walk", "14 min"], ["Noise", "Medium"], ["Typical stay", "1.6 hr"]],
      },
      {
        id: "habit",
        name: "Habit Workshop",
        meta: "1.1 mi · Mission",
        score: "8.5",
        verdict: "Best coffee",
        note: "Better espresso than the others, though laptop seating is limited to the back room.",
        caveat: "It is the farthest option and laptop seats fill quickly.",
        tags: ["great espresso", "back room", "limited seats"],
        image: "https://images.unsplash.com/photo-1511081692775-05d0f180a065?auto=format&fit=crop&w=1200&q=85",
        facts: [["Walk", "22 min"], ["Noise", "Medium"], ["Typical stay", "1.2 hr"]],
      },
    ],
  },
  {
    label: "Services",
    query: "same-day bike repair that comes to me",
    count: "9 services",
    sourceLine: "96 reviews · 14 service pages · 11 discussions",
    intent: ["same day", "mobile", "clear price"],
    sources: [["Recent reviews", "96"], ["Service pages", "14"], ["Discussions", "11"]],
    priorityPicks: { overall: "spoke", value: "freewheel", easy: "chainline", trusted: "spoke" },
    results: [
      {
        id: "spoke",
        name: "Spoke Mobile Repair",
        meta: "Today · from $65",
        score: "9.1",
        verdict: "Best fit",
        note: "Clear arrival windows, parts quoted before the visit, and the strongest recent feedback.",
        caveat: "The callout minimum makes small fixes relatively expensive.",
        tags: ["same day", "upfront price", "mobile"],
        image: "https://images.unsplash.com/photo-1529422643029-d4585747aaf2?auto=format&fit=crop&w=1200&q=85",
        facts: [["Arrival", "2–4 pm"], ["Tune-up", "$89"], ["Warranty", "30 days"]],
      },
      {
        id: "freewheel",
        name: "Freewheel Workshop",
        meta: "Tomorrow · from $45",
        score: "8.7",
        verdict: "Best value",
        note: "Lower labor rates and excellent wheel work, but pickup is required for larger jobs.",
        caveat: "Not fully mobile, and the earliest opening is tomorrow.",
        tags: ["lower price", "wheel expert", "pickup"],
        image: "https://images.unsplash.com/photo-1502744688674-c619d1586c9e?auto=format&fit=crop&w=1200&q=85",
        facts: [["Arrival", "Tomorrow"], ["Tune-up", "$69"], ["Warranty", "14 days"]],
      },
      {
        id: "chainline",
        name: "Chainline Cycles",
        meta: "Today · from $80",
        score: "8.4",
        verdict: "Fastest",
        note: "The fastest booking in the area, with a higher callout fee and fewer complex repairs.",
        caveat: "It costs more and only covers straightforward repairs on site.",
        tags: ["90-minute slot", "callout fee", "basic repairs"],
        image: "https://images.unsplash.com/photo-1571333250630-f0230c320b6d?auto=format&fit=crop&w=1200&q=85",
        facts: [["Arrival", "90 min"], ["Tune-up", "$105"], ["Warranty", "30 days"]],
      },
    ],
  },
  {
    label: "Software",
    query: "simple invoicing for a two-person studio",
    count: "18 tools",
    sourceLine: "312 reviews · 7 pricing pages · 36 discussions",
    intent: ["two people", "simple", "invoicing"],
    sources: [["Recent reviews", "312"], ["Pricing pages", "7"], ["Discussions", "36"]],
    priorityPicks: { overall: "ledgerly", value: "parcel", easy: "ledgerly", trusted: "northstar" },
    results: [
      {
        id: "ledgerly",
        name: "Ledgerly",
        meta: "$12/mo · web + mobile",
        score: "9.0",
        verdict: "Best fit",
        note: "Fast invoice setup, sensible recurring billing, and no features the studio has to manage.",
        caveat: "Reporting is intentionally light and export options are basic.",
        tags: ["quick setup", "recurring", "simple reports"],
        image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=85",
        facts: [["Monthly", "$12"], ["Seats", "Unlimited"], ["Trial", "30 days"]],
      },
      {
        id: "parcel",
        name: "Parcel Books",
        meta: "$9/mo · web",
        score: "8.6",
        verdict: "Lowest price",
        note: "A clean invoice builder at the lowest price, with lighter reporting and no native app.",
        caveat: "There is no native app and recurring invoices need more setup.",
        tags: ["low price", "clean templates", "web only"],
        image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1200&q=85",
        facts: [["Monthly", "$9"], ["Seats", "3"], ["Trial", "14 days"]],
      },
      {
        id: "northstar",
        name: "Northstar Billing",
        meta: "$19/mo · web + desktop",
        score: "8.2",
        verdict: "Most control",
        note: "Deeper reports and estimates for studios that want more control, at the cost of setup time.",
        caveat: "The setup is slower and the extra controls may be unnecessary for two people.",
        tags: ["deep reports", "estimates", "more setup"],
        image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=85",
        facts: [["Monthly", "$19"], ["Seats", "5"], ["Trial", "14 days"]],
      },
    ],
  },
];

/**
 * Suggested searches shown in the search dropdown and the "Try" chips.
 *
 * These feed the REAL recommendation engine, so every entry must land in a
 * currently supported category (analytics, hosting, dev tools, productivity,
 * design, email, AI). Local-business and physical-product queries are
 * deliberately absent until those categories are actually rankable — suggesting
 * them produced a guaranteed "not covered yet" result.
 */
export const DISCOVERY_SUGGESTIONS = [
  { label: "Analytics for a small SaaS", query: "best cheap analytics tool for a small SaaS", setIndex: 2 },
  { label: "Project management", query: "simple project management software for five developers", setIndex: 2 },
  { label: "Self-hosted + open source", query: "open source self-hosted analytics", setIndex: 2 },
  { label: "Email platform on a budget", query: "best email platform under $30 per month", setIndex: 2 },
  { label: "Design without the bloat", query: "lightweight design tool that is not bloated", setIndex: 2 },
  { label: "Hosting with a free tier", query: "hosting platform with a free tier", setIndex: 2 },
  { label: "AI assistant", query: "ai assistant with a free plan", setIndex: 2 },
];

export const QUICK_SEARCHES = DISCOVERY_SUGGESTIONS.slice(3).map((item) => item.query);

/** Shown next to the search box so coverage is never overstated. */
export const SEARCH_COVERAGE_NOTE =
  "Search currently covers software and online tools.";

export const QUERY_REFINEMENTS = [
  { label: "Start broad", query: "find me a coffee shop", intent: ["coffee"], resultId: "habit" },
  { label: "Add the setting", query: "a quiet coffee shop where I can work", intent: ["quiet", "work-friendly"], resultId: "frame" },
  { label: "Name what matters", query: "quiet coffee shop with outlets, good Wi-Fi, and parking", intent: ["quiet", "outlets", "wifi", "parking"], resultId: "marigold" },
];

export const CATEGORY_CARDS = [
  {
    kicker: "Nearby",
    title: "A place that fits the moment",
    query: "dinner for six, not too loud",
    image: "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=85",
  },
  {
    kicker: "For hire",
    title: "Someone you can count on",
    query: "electrician available this week",
    image: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=85",
  },
  {
    kicker: "To use",
    title: "The right thing, not fifty tabs",
    query: "noise-canceling headphones for travel",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=85",
  },
];
