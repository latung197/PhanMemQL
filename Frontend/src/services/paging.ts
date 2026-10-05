// Shared paging of every list (danh mục, chứng từ, nhật ký...): the same query and answer for all of them, matching
// the backend's IPagedQuery / PagedResult. A screen sends the page it wants and the filters; the server sorts, filters
// and cuts the page, and the same query (without the page) is what an Excel export of the list uses.

export interface PagedQuery {
  /** 1-based. */
  page: number;
  pageSize: number;
  /** Column name the server knows (the grid column's sortKey or key). */
  sort?: string;
  dir?: 'asc' | 'desc';
  search?: string;
  /** Filters of the screen as query parameters (status, warehouse...); empty values are not sent. */
  filters?: Record<string, string>;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** The server never returns more than this per page (PagingLimits.MaxPageSize). */
export const MAX_PAGE_SIZE = 200;
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, MAX_PAGE_SIZE];

export const clampPageSize = (size?: number) =>
  Math.min(Math.max(Math.floor(size || DEFAULT_PAGE_SIZE), 1), MAX_PAGE_SIZE);

/** Query string of a list request. `withPaging: false` gives the filter only, as an export needs it. */
export function pagedQueryString(query: PagedQuery, withPaging = true): string {
  const params = new URLSearchParams();
  if (withPaging) {
    params.set('page', String(query.page));
    params.set('pageSize', String(query.pageSize));
  }
  if (query.sort) {
    params.set('sort', query.sort);
    if (query.dir) params.set('dir', query.dir);
  }
  if (query.search?.trim()) params.set('search', query.search.trim());
  Object.entries(query.filters ?? {}).forEach(([key, value]) => { if (value) params.set(key, value); });
  const text = params.toString();
  return text ? `?${text}` : '';
}
