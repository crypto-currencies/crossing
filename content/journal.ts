export type JournalPost = {
  slug: string;
  title: string;
  dek: string;
  category: "Product note" | "Methodology" | "Field note";
  author: string;
  published: string;
  readTime: string;
  featured?: boolean;
  body: Array<{ heading?: string; paragraphs: string[] }>;
};

/**
 * Small editorial fixture used until a CMS or editorial backend exists.
 * The Journal UI labels this content as a preview; these entries are not
 * represented as live news, popularity, or customer activity.
 */
export const JOURNAL_POSTS: JournalPost[] = [
  {
    slug: "recommendations-should-show-their-work",
    title: "A recommendation should show its work",
    dek: "The useful part of a shortlist is not the winner. It is knowing why that winner fits, and where it does not.",
    category: "Methodology",
    author: "Crossing editorial",
    published: "2026-07-18",
    readTime: "4 min read",
    featured: true,
    body: [
      {
        paragraphs: [
          "Most recommendation interfaces collapse a complicated decision into a row of stars or a single score. That is easy to scan and difficult to trust.",
          "Crossing is built around a different idea: the recommendation, the evidence, and the tradeoff should be visible together. A high score without the reason behind it is only a claim.",
        ],
      },
      {
        heading: "Fit is specific",
        paragraphs: [
          "The best option changes when the request changes. A tool that is right for a solo project may be the wrong choice for a regulated team. Ranking therefore begins with the constraints in the query, not with a universal leaderboard.",
        ],
      },
      {
        heading: "Unknown is a useful answer",
        paragraphs: [
          "When a price, platform, or capability cannot be confirmed, the honest state is unknown. Filling the gap with a confident guess makes the interface look complete while making the decision worse.",
        ],
      },
    ],
  },
  {
    slug: "what-evidence-freshness-means",
    title: "What evidence freshness actually means",
    dek: "A source can be credible and still be too old for the decision in front of you.",
    category: "Product note",
    author: "Crossing editorial",
    published: "2026-07-11",
    readTime: "3 min read",
    body: [
      {
        paragraphs: [
          "Software prices, plans, and features change quickly. Crossing keeps the publication and observation context of evidence so a recommendation can distinguish current support from an old claim.",
        ],
      },
      {
        heading: "Fresh does not mean true",
        paragraphs: [
          "Recency is only one signal. A new marketing page and an older piece of technical documentation answer different questions. Source type, corroboration, and freshness belong together.",
        ],
      },
    ],
  },
  {
    slug: "designing-for-the-missing-answer",
    title: "Designing for the missing answer",
    dek: "Unsupported categories and thin evidence are product states, not error copy to hide.",
    category: "Field note",
    author: "Crossing editorial",
    published: "2026-06-27",
    readTime: "5 min read",
    body: [
      {
        paragraphs: [
          "A discovery product earns trust when it is clear about the edge of its coverage. Returning something unrelated is worse than returning nothing.",
          "That is why Crossing treats clarification, unsupported categories, limited evidence, and no results as designed outcomes with a useful next step.",
        ],
      },
    ],
  },
];

export function getJournalPost(slug: string) {
  return JOURNAL_POSTS.find((post) => post.slug === slug);
}
