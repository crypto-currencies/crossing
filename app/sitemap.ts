import type { MetadataRoute } from "next";
import { JOURNAL_POSTS } from "@/content/journal";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://crossing.dev";

const STATIC_ROUTES = [
  "",
  "/discover",
  "/browse",
  "/search",
  "/journal",
  "/about",
  "/how-it-works",
  "/ranking-methodology",
  "/business",
  "/contribute",
  "/submit",
  "/login",
  "/register",
  "/privacy",
  "/terms",
  "/cookies",
  "/policies",
  "/promotion-disclosure",
  "/attributions",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...STATIC_ROUTES.map((route, index) => ({
      url: `${BASE_URL}${route}`,
      lastModified: new Date(),
      changeFrequency: (route === "" || route === "/discover" ? "weekly" : "monthly") as "weekly" | "monthly",
      priority: index === 0 ? 1 : route === "/search" || route === "/discover" ? 0.9 : 0.6,
    })),
    ...JOURNAL_POSTS.map((post) => ({
      url: `${BASE_URL}/journal/${post.slug}`,
      lastModified: new Date(post.published),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
