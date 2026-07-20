import { ROUTES } from "@/lib/routes";

export interface NavLink {
  label: string;
  href: string;
  description?: string;
}

export interface NavGroup {
  label: string;
  links: NavLink[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Discover",
    links: [
      { label: "Explore Crossing", href: "/discover", description: "See what people are finding" },
      { label: "Search", href: ROUTES.discovery.search, description: "Start with anything you need" },
      { label: "Saved", href: ROUTES.discovery.saved, description: "Return to your shortlists" },
    ],
  },
  {
    label: "Browse",
    links: [
      { label: "All categories", href: "/browse", description: "Move through the full directory" },
      { label: "Home services", href: "/browse/home-services", description: "Help for the place you live" },
      { label: "Food & drink", href: "/browse/food-drink", description: "Places worth going to" },
      { label: "Tech & tools", href: "/browse/tech-tools", description: "Products and software" },
    ],
  },
  {
    label: "Journal",
    links: [
      { label: "Latest notes", href: ROUTES.site.journal, description: "Updates from Crossing" },
      { label: "About", href: ROUTES.site.about, description: "Why this exists" },
      { label: "Contribute", href: ROUTES.site.contribute, description: "Add what you know" },
    ],
  },
  {
    label: "For business",
    links: [
      { label: "Business overview", href: ROUTES.site.business, description: "How listings work" },
      { label: "Pricing", href: ROUTES.site.businessPricing, description: "Plans for owners" },
      { label: "Submit a listing", href: ROUTES.discovery.submit, description: "Add a place or service" },
    ],
  },
];
