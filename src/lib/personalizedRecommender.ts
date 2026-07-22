import { productService } from '@/services/productService';
import type { Product } from '@/types';

export interface RecommendationInputs {
  recentlyViewed: Product[];
  wishlistProducts: Product[];
  orderedProducts: Product[];
  categoryHistorySlugs: string[];
}

export interface RecommendationResult {
  products: Product[];
  /** Human-readable label for the strongest matched category, e.g. "Formal Shirts" — used for a "because you..." subtitle. */
  topCategoryLabel: string | null;
}

// Orders are the strongest signal (money-backed intent), then wishlist (explicit "I want this"),
// then category browsing, then casual product views last.
const CATEGORY_WEIGHTS = { recentlyViewed: 2, wishlist: 3, ordered: 4, categoryHistory: 2 };
const BRAND_WEIGHTS = { recentlyViewed: 1, wishlist: 2, ordered: 3 };
const MAX_RECOMMENDATIONS = 12;
const MAX_SEED_CATEGORIES = 4;
const CANDIDATE_POOL_SIZE = 48;

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
  applySignal(inputs.orderedProducts, CATEGORY_WEIGHTS.ordered, BRAND_WEIGHTS.ordered);
  inputs.categoryHistorySlugs.forEach((slug) => bump(categoryScores, slug, CATEGORY_WEIGHTS.categoryHistory));

  if (categoryScores.size === 0) {
    return { products: [], topCategoryLabel: null };
  }

  const topCategorySlugs = topKeys(categoryScores, MAX_SEED_CATEGORIES);
  const topBrandIds = new Set(topKeys(brandScores, MAX_SEED_CATEGORIES));

  const pool = await productService.list({ categorySlugs: topCategorySlugs, sort: 'rating', pageSize: CANDIDATE_POOL_SIZE });

  const scored = pool.items
    .filter((p) => !excludeIds.has(p.id) && p.total_stock > 0)
    .map((product) => {
      let score = (categoryScores.get(product.category?.slug ?? '') ?? 0) * 2 + (brandScores.get(product.brand_id) ?? 0) * 2 + product.rating / 5;
      if (topBrandIds.has(product.brand_id)) score += 1;
      return { product, score };
    })
    .sort((a, b) => b.score - a.score);

  return {
    products: scored.slice(0, MAX_RECOMMENDATIONS).map((s) => s.product),
    topCategoryLabel: slugToLabel(topCategorySlugs[0]),
  };
}
