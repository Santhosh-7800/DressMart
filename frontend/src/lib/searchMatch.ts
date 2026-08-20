import { COLOR_PALETTE } from '@/data/catalogSource';
import type { Product } from '@/types';

/** Single-word tokens derived from the catalog's actual color names (e.g. "Navy Blue", "Charcoal
 *  Grey" -> "navy", "blue", "charcoal", "grey") — the same palette variant.color values are drawn
 *  from, so this recognizes exactly the color words a real search could mean. Used below to require
 *  a color-shaped query word to match a product's actual variant color, not merely appear somewhere
 *  in its tags/description (see scoreProductMatch's matchedTokenCount loop). */
const KNOWN_COLOR_WORDS = new Set(COLOR_PALETTE.flatMap((c) => tokenize(c.name)));

/**
 * Shared free-text matching primitives, used by both productService.list()'s search filter and
 * personalizedRecommender.ts's search-history signal extraction — one tokenizer/fuzzy-match
 * implementation instead of two copies of the same logic.
 */

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Collapses whitespace/case the same way search-history normalization does (see
 *  userActivityService.ts's normalizeQuery) — used for whole-string equality checks (exact SKU/
 *  name/brand/color/category match), as opposed to `tokenize`'s per-word breakdown. */
export function normalizePhrase(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Loose match so a search for "shirt"/"jean" recognizes catalog names like "Shirts"/"Jeans" —
 *  there's no stemming library here, just a prefix check guarded by a minimum length so short
 *  words ("s", "of") can't fuzzy-match everything. */
export function wordsRelated(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 3 || b.length < 3) return false;
  return a.startsWith(b) || b.startsWith(a);
}

export function queryMatchesText(queryTokens: string[], text: string): boolean {
  const textTokens = tokenize(text);
  return textTokens.some((tt) => queryTokens.some((qt) => wordsRelated(tt, qt)));
}

/** Per-product searchable index — built fresh from the product's own fields every time (never
 *  persisted to Firestore, see productService.ts's search filter), covering every field the
 *  product/product-search spec calls out: name, SKU, brand, category, subcategory, gender, every
 *  variant's color/size, tags, description, and every specification value (fabric/pattern/fit/
 *  sleeve/collar/occasion/etc. — generic over whatever keys exist, so a new specification field
 *  becomes searchable automatically). */
export interface ProductSearchIndex {
  tokens: Set<string>;
  nameLower: string;
  skuLower: string;
  brandLower: string;
  categoryLower: string;
  subcategoryLower: string;
  colorsLower: string[];
}

export function buildProductSearchIndex(p: Product): ProductSearchIndex {
  const specValues = Object.values(p.specifications ?? {}).filter((v): v is string => typeof v === 'string');
  const colorsLower = [...new Set(p.variants.map((v) => v.color.toLowerCase()))];
  const parts = [
    p.name,
    p.sku,
    p.brand?.name,
    p.category?.name,
    p.subcategory,
    p.gender,
    ...p.variants.map((v) => v.color),
    ...p.variants.map((v) => v.size),
    ...p.tags,
    p.description,
    ...specValues,
  ].filter((v): v is string => Boolean(v));

  return {
    tokens: new Set(parts.flatMap(tokenize)),
    nameLower: p.name.toLowerCase(),
    skuLower: p.sku.toLowerCase(),
    brandLower: (p.brand?.name ?? '').toLowerCase(),
    categoryLower: (p.category?.name ?? '').toLowerCase(),
    subcategoryLower: (p.subcategory ?? '').toLowerCase(),
    colorsLower,
  };
}

export interface SearchMatchResult {
  /** Higher is more relevant — see productService.ts's priority tiers (exact SKU > name > brand > color > category > multi-field coverage). */
  score: number;
  /** How many of the query's distinct tokens matched anywhere in the index — used to separate
   *  "matches every concept in the query" (color AND category, e.g. "blue shirt") from a weaker
   *  partial/fallback hit. */
  matchedTokenCount: number;
  totalTokens: number;
}

/**
 * Scores one product against a free-text query. `queryPhrase` should already be normalized
 * (see normalizePhrase) and non-empty.
 */
export function scoreProductMatch(index: ProductSearchIndex, queryPhrase: string): SearchMatchResult {
  const queryTokens = tokenize(queryPhrase);
  let score = 0;

  // Priority 1: exact/partial SKU match — the strongest possible signal, since a SKU is unique.
  if (index.skuLower === queryPhrase) score += 10_000;
  else if (index.skuLower.includes(queryPhrase)) score += 3_000;

  // Priority 2: exact/partial product name match.
  if (index.nameLower === queryPhrase) score += 5_000;
  else if (index.nameLower.includes(queryPhrase)) score += 1_500;

  // Priority 3: exact brand match.
  if (index.brandLower === queryPhrase) score += 2_500;

  // Priority 4: exact color match (the whole query names one color exactly, e.g. "navy blue").
  if (index.colorsLower.includes(queryPhrase)) score += 2_000;

  // Priority 5: exact category/subcategory match.
  if (index.categoryLower === queryPhrase || index.subcategoryLower === queryPhrase) score += 1_800;

  // Priority 6: multi-field/multi-token coverage — how many distinct query concepts (brand, color,
  // category, gender, ...) this product actually satisfies, e.g. "blue puma shirt" rewards a
  // product that's simultaneously blue AND a shirt over one that's merely blue.
  //
  // A color-shaped token (e.g. "black") is checked ONLY against the product's actual variant
  // colors, never against the generic token set — otherwise a red shirt merely tagged
  // "black-friday" or described as "pairs well with black trousers" would satisfy a "black" search,
  // surfacing a product whose real color has nothing to do with the query.
  let matchedTokenCount = 0;
  for (const qt of queryTokens) {
    const matched = KNOWN_COLOR_WORDS.has(qt)
      ? index.colorsLower.some((c) => tokenize(c).some((ct) => wordsRelated(ct, qt)))
      : [...index.tokens].some((t) => wordsRelated(t, qt));
    if (matched) matchedTokenCount += 1;
  }
  score += matchedTokenCount * 150;

  return { score, matchedTokenCount, totalTokens: queryTokens.length };
}
