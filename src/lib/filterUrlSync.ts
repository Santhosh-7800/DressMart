import type { SortOption } from '@/types';

/**
 * Puts listing-page state (filters/sort/pagination) in the URL query string instead of plain
 * component state. This is what actually makes Back/Forward preserve it — React Router's history
 * stack IS the URL, so a page that reads its state FROM the URL naturally gets it back for free
 * when the browser restores a previous URL, with no manual save/restore bookkeeping needed. A page
 * that only kept this in useState loses it the moment the component unmounts (e.g. navigating to a
 * product) and remounts fresh on Back.
 */
export interface UrlSyncableFilters {
  brandIds?: string[];
  colors?: string[];
  sizes?: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  minDiscount?: number;
  inStockOnly?: boolean;
  sort?: SortOption;
  page?: number;
}

export function filtersFromSearchParams(params: URLSearchParams): UrlSyncableFilters {
  const csv = (key: string) => {
    const v = params.get(key);
    return v ? v.split(',').filter(Boolean) : undefined;
  };
  const num = (key: string) => {
    const v = params.get(key);
    return v !== null && v !== '' ? Number(v) : undefined;
  };

  return {
    brandIds: csv('brands'),
    colors: csv('colors'),
    sizes: csv('sizes'),
    minPrice: num('minPrice'),
    maxPrice: num('maxPrice'),
    minRating: num('minRating'),
    minDiscount: num('minDiscount'),
    inStockOnly: params.get('inStock') === '1' ? true : undefined,
    sort: (params.get('sort') as SortOption | null) ?? undefined,
    page: num('page'),
  };
}

/** Merges the syncable filter fields onto an existing URLSearchParams (preserving any other param,
 *  e.g. `q` on the search page), dropping keys that are unset/default so the URL stays clean. */
export function applyFiltersToSearchParams(existing: URLSearchParams, filters: UrlSyncableFilters): URLSearchParams {
  const next = new URLSearchParams(existing);
  const setOrDelete = (key: string, value: string | undefined | null) => {
    if (value === undefined || value === null || value === '') next.delete(key);
    else next.set(key, value);
  };

  setOrDelete('brands', filters.brandIds?.length ? filters.brandIds.join(',') : undefined);
  setOrDelete('colors', filters.colors?.length ? filters.colors.join(',') : undefined);
  setOrDelete('sizes', filters.sizes?.length ? filters.sizes.join(',') : undefined);
  setOrDelete('minPrice', filters.minPrice !== undefined ? String(filters.minPrice) : undefined);
  setOrDelete('maxPrice', filters.maxPrice !== undefined ? String(filters.maxPrice) : undefined);
  setOrDelete('minRating', filters.minRating !== undefined ? String(filters.minRating) : undefined);
  setOrDelete('minDiscount', filters.minDiscount !== undefined ? String(filters.minDiscount) : undefined);
  setOrDelete('inStock', filters.inStockOnly ? '1' : undefined);
  setOrDelete('sort', filters.sort && filters.sort !== 'popularity' ? filters.sort : undefined);
  setOrDelete('page', filters.page && filters.page > 1 ? String(filters.page) : undefined);

  return next;
}
