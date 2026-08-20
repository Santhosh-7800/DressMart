import { tokenize, wordsRelated } from '@/lib/searchMatch';
import type { Category, DetectedClothingAttributes, Product } from '@/types';

export type { DetectedClothingAttributes } from '@/types';

/** Sums to exactly 100 — see the visual search spec this implements. */
const SCORE = {
  category: 35,
  subcategory: 20,
  primaryColor: 20,
  secondaryColor: 5,
  pattern: 8,
  style: 5,
  fit: 4,
  other: 3,
};

function fieldRelates(productField: string | null | undefined, detected: string | null): boolean {
  if (!productField || !detected) return false;
  const pTokens = tokenize(productField);
  const dTokens = tokenize(detected);
  return dTokens.some((dt) => pTokens.some((pt) => wordsRelated(pt, dt)));
}

/**
 * Scores one product against detected image attributes, 0-100. Mirrors searchMatch.ts's
 * scoreProductMatch in spirit (reusing its tokenize/wordsRelated primitives) but with the
 * visual-search-specific weighting the spec calls for, rather than free-text relevance.
 */
/** Exact color match scores in full; a same-family shade (e.g. detected "Navy Blue" vs. a product
 *  stocked in "Royal Blue" — both share the "blue" token) scores half credit, so ranking still
 *  prefers an exact color but doesn't drop a same-style product just for being a different shade of
 *  the same color family. Two colors that share no words at all (e.g. "Navy Blue" vs. "Red") score
 *  nothing here — this is why an unrelated product doesn't rank higher merely for having "blue"
 *  somewhere in its tags/description; only the actual variant color values are compared. */
function colorMatchScore(productColors: Set<string>, detected: string | null, fullScore: number): number {
  if (!detected) return 0;
  const detectedLower = detected.toLowerCase();
  if (productColors.has(detectedLower)) return fullScore;
  const relatesToAny = [...productColors].some((c) => fieldRelates(c, detected));
  return relatesToAny ? fullScore * 0.5 : 0;
}

export function scoreVisualMatch(product: Product, attrs: DetectedClothingAttributes): number {
  let score = 0;

  if (fieldRelates(product.category?.name, attrs.garmentType)) score += SCORE.category;
  if (fieldRelates(product.subcategory, attrs.garmentType)) score += SCORE.subcategory;

  const productColors = new Set(product.variants.map((v) => v.color.toLowerCase()));
  score += colorMatchScore(productColors, attrs.primaryColor, SCORE.primaryColor);
  score += colorMatchScore(productColors, attrs.secondaryColor, SCORE.secondaryColor);

  if (fieldRelates(product.specifications?.pattern, attrs.pattern)) score += SCORE.pattern;
  if (fieldRelates(product.specifications?.occasion, attrs.style)) score += SCORE.style;
  if (fieldRelates(product.specifications?.fit, attrs.fit)) score += SCORE.fit;
  if (fieldRelates(product.specifications?.sleeve, attrs.sleeveType)) score += SCORE.other;

  return Math.min(100, score);
}

/** Categories whose name textually relates to the detected garment type (e.g. "Shirt" -> "Formal
 *  Shirts", "Casual Shirts", ...) — used to build a topically-relevant candidate pool without
 *  hardcoding a garment/category map: it reads whatever categories actually exist in Firestore for
 *  this gender (works identically for Men's and Kids' categories, and picks up new ones sellers add
 *  later with no code change). Falls back to every category for the gender when nothing relates
 *  closely, rather than an empty pool — still gender-scoped, never the whole cross-gender catalog. */
export function findRelatedCategorySlugs(garmentType: string, categories: Category[]): string[] {
  const related = categories.filter((c) => fieldRelates(c.name, garmentType)).map((c) => c.slug);
  return related.length > 0 ? related : categories.map((c) => c.slug);
}

/** Below this, results are "loosely related at best" — the results page uses it to decide whether
 *  to show the "no exact match, here's what's close" messaging instead of presenting them as
 *  confident matches. */
export const LOW_CONFIDENCE_SCORE_THRESHOLD = 30;
