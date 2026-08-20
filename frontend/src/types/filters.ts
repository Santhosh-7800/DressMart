import type { Gender } from './database';

export type SortOption =
  | 'popularity'
  | 'newest'
  | 'price_low_high'
  | 'price_high_low'
  | 'rating'
  | 'discount';

/** Normalized clothing attributes from visual search's AI image analysis (see
 *  services/visualSearchService.ts) — already mapped onto DressMart's actual catalog color/garment
 *  vocabulary by the time this reaches ProductFilters. `style` corresponds to
 *  `product.specifications.occasion` (Formal/Casual/Party/Everyday/Sports/Ethnic), the closest
 *  existing schema field to "style". */
export interface DetectedClothingAttributes {
  garmentType: string;
  gender: Gender | null;
  primaryColor: string;
  secondaryColor: string | null;
  pattern: string | null;
  style: string | null;
  sleeveType: string | null;
  fit: string | null;
  confidence: number;
}

export interface ProductFilters {
  gender?: Gender;
  categorySlugs?: string[];
  brandIds?: string[];
  colors?: string[];
  sizes?: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  minDiscount?: number;
  inStockOnly?: boolean;
  search?: string;
  /** Set by visual search instead of `search` — see productService.ts's applyVisualSearch, which
   *  scores/ranks products against these attributes the same way applySearch does for free text. */
  visualAttributes?: DetectedClothingAttributes;
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
}

export interface ProductFacets {
  brands: FacetCount[];
  colors: FacetCount[];
  sizes: FacetCount[];
  priceRange: { min: number; max: number };
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
