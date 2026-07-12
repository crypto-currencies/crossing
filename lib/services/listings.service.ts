import type { ListingCard } from "@/types";
import { apiFetch } from "./utils";

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface SearchListingsParams {
  q: string;
  category?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Client-side re-fetch for the /search page's interactive follow-ups
 * (typing, paging, changing the category filter) after the initial
 * server-rendered result. Returns null on any network/parse error — the
 * search page treats that as its error state.
 */
export const listingsService = {
  async search(params: SearchListingsParams): Promise<PagedResult<ListingCard> | null> {
    const qs = new URLSearchParams();
    qs.set("q", params.q);
    if (params.category) qs.set("category", params.category);
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));

    return apiFetch<PagedResult<ListingCard>>(`/api/listings/search?${qs.toString()}`);
  },
};
