import type { Gender } from './database';

export type SortOption =
  | 'popularity'
  | 'newest'
  | 'price_low_high'
  | 'price_high_low'
  | 'rating'
  | 'discount';

export interface ProductFilters {
  gender?: Gender;
  categorySlugs?: string[];
  brandIds?: string[];
  colors?: string[];
  sizes?: string[];
  /** Matches Product.specifications.occasion (e.g. "Casual", "Formal", "Party") — powers the
   *  "Narrow your search" quick-filter tiles alongside `patterns` below. */
  occasions?: string[];
  /** Matches Product.specifications.pattern (e.g. "Solid", "Printed"). */
  patterns?: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  minDiscount?: number;
  inStockOnly?: boolean;
  search?: string;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}

export interface FacetCount<T extends string = string> {
  /** The actual filterable key — for brands this is the brand id, never its display name. */
  value: T;
  /** Human-readable text to render, when it differs from `value` (e.g. a brand's name vs. its id). */
  label?: string;
  count: number;
  /** A real product photo representing this facet value — e.g. one product's coverImage for the
   *  "Formal" occasion tile. Only populated for facets rendered as an image tile (occasions,
   *  patterns); never a fabricated/stock photo. */
  sampleImageUrl?: string;
}

export interface ProductFacets {
  brands: FacetCount[];
  colors: FacetCount[];
  sizes: FacetCount[];
  occasions: FacetCount[];
  patterns: FacetCount[];
  priceRange: { min: number; max: number };
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
