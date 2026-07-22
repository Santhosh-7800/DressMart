import { productService, brandService } from '@/services/productService';
import { getOccasion } from './outfitRecommender';
import type { Product } from '@/types';

export interface StyleQuizAnswers {
  color: string;
  fit: string;
  budgetMin: number;
  budgetMax: number;
  occasionKey: string;
  favoriteBrandSlugs: string[];
}

export interface StyleQuizResult {
  products: Product[];
  summary: string;
}

/**
 * Turns quiz answers into a ranked, catalog-backed product list: pulls candidates from the
 * categories tied to the chosen occasion within budget, then scores each by brand/color/fit
 * match. Same productService every other page uses, so it works in mock mode and against a
 * real Supabase project without any changes.
 */
export async function generateStyleRecommendations(answers: StyleQuizAnswers): Promise<StyleQuizResult> {
  const occasion = getOccasion(answers.occasionKey);
  const categorySlugs = occasion?.slots.map((s) => s.categorySlug);

  const [listResult, brands] = await Promise.all([
    productService.list({
      gender: 'men',
      categorySlugs,
      minPrice: answers.budgetMin,
      maxPrice: answers.budgetMax,
      sort: 'rating',
      pageSize: 40,
    }),
    brandService.list(),
  ]);

  const favoriteBrandIds = new Set(brands.filter((b) => answers.favoriteBrandSlugs.includes(b.slug)).map((b) => b.id));

  const scored = listResult.items.map((product) => {
    let score = product.rating;
    if (favoriteBrandIds.has(product.brand_id)) score += 3;
    if (product.variants.some((v) => v.color === answers.color)) score += 2;
    if (product.specifications.fit === answers.fit) score += 1.5;
    return { product, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const products = scored.slice(0, 12).map((s) => s.product);

  const favoriteBrandNames = brands.filter((b) => favoriteBrandIds.has(b.id)).map((b) => b.name);
  const highlights = [answers.color, answers.fit, ...favoriteBrandNames].filter(Boolean);
  const occasionPhrase = occasion ? ` for ${occasion.label.toLowerCase()}` : '';
  const summary =
    products.length > 0
      ? `${products.length} picks curated for your love of ${highlights.join(', ')}${occasionPhrase}.`
      : `We couldn't find matches in this budget${occasionPhrase} — try widening your budget or picking a different occasion.`;

  return { products, summary };
}
