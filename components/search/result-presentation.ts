import type { RankedResult } from "@/features/search/response";
import { SEARCH_LANGUAGE, sourceCoverageLabel } from "./search-language";

export function priceSummary(item: RankedResult): string {
  return item.priceSummary?.display ?? SEARCH_LANGUAGE.pricing.missing;
}

export function bestFor(item: RankedResult): string {
  return item.bestFor ?? SEARCH_LANGUAGE.results.bestForFallback;
}

export function primaryTradeoff(item: RankedResult): string {
  return item.tradeoffs[0] ?? SEARCH_LANGUAGE.results.noTradeoff;
}

export function primaryReason(item: RankedResult): string {
  return item.shortReason;
}

export function resultInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function checkedDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Check date unavailable";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function evidenceStrengthLabel(item: RankedResult): string {
  return sourceCoverageLabel(item);
}
