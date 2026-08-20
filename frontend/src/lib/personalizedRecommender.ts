import { productService } from '@/services/productService';
import { COLOR_PALETTE } from '@/data/catalogSource';
import { queryMatchesText, tokenize } from '@/lib/searchMatch';
import type { Brand, Category, Product, SearchHistoryEntry } from '@/types';

export interface RecommendationInputs {
  recentlyViewed: Product[];
  wishlistProducts: Product[];
  orderedProducts: Product[];
  /** Products currently in the active cart — a stronger buying-intent signal than a recent view or
   *  even a wishlist add, since the user has already committed to a specific size/color. */
  cartProducts: Product[];
  categoryHistorySlugs: string[];
  /** Most-recent-first. Optional — omitted (or empty) for guests, who never get a Firestore search
   *  history (see useSearch.ts). */
  searchHistory?: SearchHistoryEntry[];
  /** Only needed to make sense of `searchHistory` — cheap, already-cached reference data (see
   *  usePersonalizedRecommendations.ts, which reuses the same query keys as useSearch.ts). */
  categories?: Category[];
  brands?: Brand[];
}

export interface RecommendationResult {
  products: Product[];
  /** Human-readable label for the strongest matched category, e.g. "Formal Shirts" — used for a "because you..." subtitle. */
  topCategoryLabel: string | null;
}

// Orders are the strongest signal (money-backed intent), then cart (already committed to a
// size/color, just short of paying), then wishlist (explicit "I want this"), then category
// browsing/search, then casual product views last.
const CATEGORY_WEIGHTS = { recentlyViewed: 2, wishlist: 3, cart: 3, ordered: 4, categoryHistory: 2, search: 2 };
const BRAND_WEIGHTS = { recentlyViewed: 1, wishlist: 2, cart: 2, ordered: 3, search: 2 };
const MAX_RECOMMENDATIONS = 12;
const MAX_SEED_CATEGORIES = 4;
const CANDIDATE_POOL_SIZE = 48;
const MAX_SEARCH_ENTRIES_CONSIDERED = 10;
const MAX_EXACT_MATCH_RESULTS = 4;
const COLOR_MATCH_BONUS = 1.5;
const MIN_RESULTS_BEFORE_FALLBACK = 6;

function bump(map: Map<string, number>, key: string | undefined | null, weight: number): void {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + weight);
}

function topKeys(map: Map<string, number>, limit: number): string[] {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);
}

function slugToLabel(slug: string): string {
  return slug
    .split('-')
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(' ');
}

interface SearchSignals {
  categoryScores: Map<string, number>;
  brandScores: Map<string, number>;
  colorNames: Set<string>;
  /** Up to 2 most-recent raw query strings, for an "exact search match" fetch. */
  recentQueries: string[];
}

/**
 * Turns free-text search history into the same category/brand vocabulary the rest of the
 * recommender already scores on, plus a color set matched against the app's real color palette
 * (catalogSource.ts's COLOR_PALETTE — the same list products are actually seeded/edited with, so a
 * match here corresponds to a real `variant.color` value). Only the most recent
 * MAX_SEARCH_ENTRIES_CONSIDERED entries are considered, with a mild recency decay.
 */
function extractSearchSignals(searchHistory: SearchHistoryEntry[], categories: Category[], brands: Brand[]): SearchSignals {
  const categoryScores = new Map<string, number>();
  const brandScores = new Map<string, number>();
  const colorNames = new Set<string>();
  const leafCategories = categories.filter((c) => c.parent_id);

  const recent = searchHistory.slice(0, MAX_SEARCH_ENTRIES_CONSIDERED);
  recent.forEach((entry, index) => {
    const tokens = tokenize(entry.normalized_query);
    if (tokens.length === 0) return;
    const weight = Math.max(1, CATEGORY_WEIGHTS.search - Math.floor(index / 5));

    leafCategories.forEach((c) => {
      if (queryMatchesText(tokens, c.name)) bump(categoryScores, c.slug, weight);
    });
    brands.forEach((b) => {
      if (queryMatchesText(tokens, b.name)) bump(brandScores, b.id, Math.max(1, BRAND_WEIGHTS.search - Math.floor(index / 5)));
    });
    COLOR_PALETTE.forEach(({ name }) => {
      if (queryMatchesText(tokens, name)) colorNames.add(name);
    });
  });

  return { categoryScores, brandScores, colorNames, recentQueries: recent.slice(0, 2).map((e) => e.query) };
}

export async function buildPersonalizedRecommendations(inputs: RecommendationInputs): Promise<RecommendationResult> {
  const categoryScores = new Map<string, number>();
  const brandScores = new Map<string, number>();
  const excludeIds = new Set<string>();

  const applySignal = (products: Product[], categoryWeight: number, brandWeight: number) => {
    products.forEach((p) => {
      bump(categoryScores, p.category?.slug, categoryWeight);
      bump(brandScores, p.brand_id, brandWeight);
      excludeIds.add(p.id);
    });
  };

  applySignal(inputs.recentlyViewed, CATEGORY_WEIGHTS.recentlyViewed, BRAND_WEIGHTS.recentlyViewed);
  applySignal(inputs.wishlistProducts, CATEGORY_WEIGHTS.wishlist, BRAND_WEIGHTS.wishlist);
  applySignal(inputs.cartProducts, CATEGORY_WEIGHTS.cart, BRAND_WEIGHTS.cart);
  applySignal(inputs.orderedProducts, CATEGORY_WEIGHTS.ordered, BRAND_WEIGHTS.ordered);
  inputs.categoryHistorySlugs.forEach((slug) => bump(categoryScores, slug, CATEGORY_WEIGHTS.categoryHistory));

  const searchHistory = inputs.searchHistory ?? [];
  const searchSignals =
    searchHistory.length > 0 ? extractSearchSignals(searchHistory, inputs.categories ?? [], inputs.brands ?? []) : null;
  searchSignals?.categoryScores.forEach((weight, slug) => bump(categoryScores, slug, weight));
  searchSignals?.brandScores.forEach((weight, brandId) => bump(brandScores, brandId, weight));

  if (categoryScores.size === 0) {
    return { products: [], topCategoryLabel: null };
  }

  const topCategorySlugs = topKeys(categoryScores, MAX_SEED_CATEGORIES);
  const topBrandIds = new Set(topKeys(brandScores, MAX_SEED_CATEGORIES));
  const colorNames = searchSignals?.colorNames ?? new Set<string>();

  // Priority 1 (see spec): exact matches for the customer's most recent literal search terms,
  // reusing the exact same `search` filter SearchResultsPage itself runs — not a second search
  // mechanism, just the existing one re-run for the same term. Placed at the front of the list.
  const exactMatches: Product[] = [];
  for (const term of searchSignals?.recentQueries ?? []) {
    if (exactMatches.length >= MAX_EXACT_MATCH_RESULTS) break;
    const result = await productService.list({ search: term, sort: 'rating', pageSize: MAX_EXACT_MATCH_RESULTS });
    result.items.forEach((p) => {
      if (exactMatches.length < MAX_EXACT_MATCH_RESULTS && !excludeIds.has(p.id) && !exactMatches.some((e) => e.id === p.id)) {
        exactMatches.push(p);
      }
    });
  }
  exactMatches.forEach((p) => excludeIds.add(p.id));

  const pool = await productService.list({ categorySlugs: topCategorySlugs, sort: 'rating', pageSize: CANDIDATE_POOL_SIZE });

  // Stock now lives in a separate inventory doc (see types/database.ts), not on Product — checking
  // it for every candidate here would mean a batch of extra reads just to build a recommendation
  // list. Out-of-stock items still get recommended; the PDP/cart are where stock is actually enforced.
  const scored = pool.items
    .filter((p) => !excludeIds.has(p.id))
    .map((product) => {
      let score = (categoryScores.get(product.category?.slug ?? '') ?? 0) * 2 + (brandScores.get(product.brand_id) ?? 0) * 2 + product.rating / 5;
      if (topBrandIds.has(product.brand_id)) score += 1;
      if (colorNames.size > 0 && product.variants.some((v) => colorNames.has(v.color))) score += COLOR_MATCH_BONUS;
      return { product, score };
    })
    .sort((a, b) => b.score - a.score);

  let products = [...exactMatches, ...scored.slice(0, MAX_RECOMMENDATIONS - exactMatches.length).map((s) => s.product)];

  // Priority 7 (see spec): pad with popular products when personalized signals alone don't produce
  // enough — reuses the existing bestsellers query rather than a new one.
  if (products.length < MIN_RESULTS_BEFORE_FALLBACK) {
    const usedIds = new Set(products.map((p) => p.id));
    const popular = await productService.getBestSellers();
    for (const p of popular) {
      if (products.length >= MIN_RESULTS_BEFORE_FALLBACK) break;
      if (usedIds.has(p.id) || excludeIds.has(p.id)) continue;
      usedIds.add(p.id);
      products.push(p);
    }
  }
  products = products.slice(0, MAX_RECOMMENDATIONS);

  return {
    products,
    topCategoryLabel: slugToLabel(topCategorySlugs[0]),
  };
}
