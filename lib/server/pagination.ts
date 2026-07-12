/** Shared pagination clamp used by every list endpoint in the discovery domain. */

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export interface PageParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

/** Clamps arbitrary (possibly attacker-controlled) query params to safe bounds. */
export function parsePageParams(searchParams: URLSearchParams): PageParams {
  const rawPage = Number(searchParams.get("page") ?? "1");
  const rawPageSize = Number(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE));

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize >= 1
      ? Math.min(Math.floor(rawPageSize), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
