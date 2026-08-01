import { productService } from '@/services/productService';
import type { Gender, Product } from '@/types';

export interface LookSlotDef {
  key: string;
  label: string;
  categorySlugs: string[];
}

const MEN_TOP_SLOT: LookSlotDef = {
  key: 'top',
  label: 'Top Wear',
  categorySlugs: ['casual-shirts', 'formal-shirts', 'printed-shirts', 'solid-shirts', 'round-neck-tshirts', 'polo-tshirts', 'henley-tshirts', 'oversized-tshirts'],
};

/** Shown whenever the viewed product isn't one of these itself. Footwear/wallet/watch slots were
 *  removed along with those categories — see documentation/README.md's catalog scope. */
const MEN_PRIMARY_SLOTS: LookSlotDef[] = [
  { key: 'bottom', label: 'Pants', categorySlugs: ['regular-jeans', 'slim-jeans', 'formal-pants', 'cargo-pants', 'joggers'] },
  { key: 'belt', label: 'Belt', categorySlugs: ['belts'] },
];

/** Kids' catalog has no belt/wallet/watch/footwear equivalents, so the slot set is simpler. */
const KIDS_SLOTS: LookSlotDef[] = [
  { key: 'top', label: 'Top Wear', categorySlugs: ['kids-tshirts', 'kids-shirts', 'school-uniform', 'kids-party-wear'] },
  { key: 'bottom', label: 'Bottoms', categorySlugs: ['kids-jeans', 'kids-shorts', 'kids-joggers'] },
  { key: 'layer', label: 'Layer', categorySlugs: ['kids-hoodies', 'kids-jackets'] },
];

const NEUTRAL_COLORS = new Set(['Black', 'White', 'Charcoal Grey', 'Navy Blue', 'Beige', 'Khaki', 'Steel Grey', 'Brown', 'Denim Blue']);

function slotKeyForCategory(slots: LookSlotDef[], categorySlug: string | undefined): string | null {
  if (!categorySlug) return null;
  return slots.find((s) => s.categorySlugs.includes(categorySlug))?.key ?? null;
}

/** Builds the slot list for a given product: the category it belongs to is swapped out for a complementary one. */
function resolveSlots(product: Product): LookSlotDef[] {
  if (product.gender === 'kids') {
    const currentKey = slotKeyForCategory(KIDS_SLOTS, product.category?.slug);
    return KIDS_SLOTS.filter((s) => s.key !== currentKey);
  }

  const allMenSlots = [MEN_TOP_SLOT, ...MEN_PRIMARY_SLOTS];
  const currentKey = slotKeyForCategory(allMenSlots, product.category?.slug);
  let slots = MEN_PRIMARY_SLOTS.filter((s) => s.key !== currentKey);
  if (currentKey && currentKey !== MEN_TOP_SLOT.key) {
    slots = [MEN_TOP_SLOT, ...slots];
  }
  return slots.slice(0, 5);
}

/** Scores a candidate product's colors against the viewed product's colors — exact match beats neutral beats anything else. */
function colorScore(baseColors: string[], candidateColors: string[]): number {
  let best = 0;
  for (const color of candidateColors) {
    if (baseColors.includes(color)) best = Math.max(best, 2);
    else if (NEUTRAL_COLORS.has(color)) best = Math.max(best, 1);
  }
  return best;
}

export interface CompleteTheLookItem {
  slot: LookSlotDef;
  product: Product;
}

export async function buildCompleteTheLook(product: Product): Promise<CompleteTheLookItem[]> {
  const slots = resolveSlots(product);
  const baseColors = product.variants.map((v) => v.color);
  const gender: Gender = product.gender;

  const resolved = await Promise.all(
    slots.map(async (slot): Promise<CompleteTheLookItem | null> => {
      const result = await productService.list({
        gender,
        categorySlugs: slot.categorySlugs,
        sort: 'rating',
        pageSize: 8,
      });
      const candidates = result.items.filter((p) => p.id !== product.id);
      if (candidates.length === 0) return null;

      const [best] = candidates
        .map((p) => ({ product: p, score: colorScore(baseColors, p.variants.map((v) => v.color)) }))
        .sort((a, b) => b.score - a.score || b.product.rating - a.product.rating);

      return { slot, product: best.product };
    }),
  );

  return resolved.filter((item): item is CompleteTheLookItem => item !== null);
}
