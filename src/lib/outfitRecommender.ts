import { productService } from '@/services/productService';
import type { Product } from '@/types';

export interface OutfitSlotDef {
  slot: string;
  label: string;
  categorySlug: string;
}

export interface OccasionDef {
  key: string;
  label: string;
  greeting: string;
  keywords: string[];
  slots: OutfitSlotDef[];
}

/**
 * Rule-based occasion → outfit mapping over the real product catalog.
 * Each occasion pulls one item per "slot" from the matching category so the
 * assistant recommends a genuinely complete, coordinated look rather than a
 * single product — using the same productService every other page uses, so
 * it works identically in mock mode and against a real Supabase project.
 */
export const OCCASIONS: OccasionDef[] = [
  {
    key: 'office',
    label: 'Office Wear',
    greeting: "Here's a sharp, professional look for the office:",
    keywords: ['office', 'work', 'formal', 'workplace', 'meeting', 'interview'],
    slots: [
      { slot: 'top', label: 'Shirt', categorySlug: 'formal-shirts' },
      { slot: 'bottom', label: 'Pants', categorySlug: 'formal-pants' },
      { slot: 'footwear', label: 'Shoes', categorySlug: 'loafers' },
      { slot: 'accessory', label: 'Watch', categorySlug: 'watches' },
    ],
  },
  {
    key: 'casual',
    label: 'Casual Outfit',
    greeting: 'Here\'s an easy, everyday casual look:',
    keywords: ['casual', 'everyday', 'weekend', 'chill', 'relaxed', 'hangout'],
    slots: [
      { slot: 'top', label: 'Shirt', categorySlug: 'casual-shirts' },
      { slot: 'bottom', label: 'Jeans', categorySlug: 'regular-jeans' },
      { slot: 'footwear', label: 'Sneakers', categorySlug: 'sneakers' },
    ],
  },
  {
    key: 'wedding',
    label: 'Wedding Outfit',
    greeting: 'Here\'s a festive look for a wedding or celebration:',
    keywords: ['wedding', 'marriage', 'sherwani', 'ethnic', 'festive', 'ceremony', 'reception'],
    slots: [
      { slot: 'top', label: 'Sherwani', categorySlug: 'sherwanis' },
      { slot: 'footwear', label: 'Shoes', categorySlug: 'loafers' },
      { slot: 'accessory', label: 'Watch', categorySlug: 'watches' },
    ],
  },
  {
    key: 'party',
    label: 'Party Wear',
    greeting: 'Here\'s a look that will stand out at the party:',
    keywords: ['party', 'club', 'night out', 'celebration', 'birthday'],
    slots: [
      { slot: 'top', label: 'Shirt', categorySlug: 'printed-shirts' },
      { slot: 'bottom', label: 'Jeans', categorySlug: 'slim-jeans' },
      { slot: 'layer', label: 'Jacket', categorySlug: 'jackets' },
      { slot: 'footwear', label: 'Sneakers', categorySlug: 'sneakers' },
    ],
  },
  {
    key: 'college',
    label: 'College Wear',
    greeting: 'Here\'s a comfy, campus-ready look:',
    keywords: ['college', 'university', 'campus', 'student', 'school'],
    slots: [
      { slot: 'top', label: 'T-Shirt', categorySlug: 'oversized-tshirts' },
      { slot: 'bottom', label: 'Joggers', categorySlug: 'joggers' },
      { slot: 'layer', label: 'Hoodie', categorySlug: 'hoodies' },
      { slot: 'footwear', label: 'Sneakers', categorySlug: 'sneakers' },
    ],
  },
];

export interface OutfitItem {
  slot: string;
  label: string;
  product: Product;
}

export interface OutfitRecommendation {
  occasion: OccasionDef;
  items: OutfitItem[];
  totalPrice: number;
  totalMrp: number;
}

/** Matches free-typed text to an occasion by keyword, falling back to null if nothing matches. */
export function matchOccasionFromText(text: string): OccasionDef | null {
  const lower = text.toLowerCase();
  return (
    OCCASIONS.find((o) => o.label.toLowerCase() === lower) ??
    OCCASIONS.find((o) => o.keywords.some((k) => lower.includes(k))) ??
    null
  );
}

export function getOccasion(key: string): OccasionDef | undefined {
  return OCCASIONS.find((o) => o.key === key);
}

async function pickProductForSlot(slot: OutfitSlotDef): Promise<Product | null> {
  const result = await productService.list({
    gender: 'men',
    categorySlugs: [slot.categorySlug],
    sort: 'rating',
    pageSize: 5,
  });
  if (result.items.length === 0) return null;
  // Pick randomly among the top-rated matches so repeat requests feel fresh, not identical.
  return result.items[Math.floor(Math.random() * result.items.length)];
}

export async function recommendOutfit(occasionKey: string): Promise<OutfitRecommendation | null> {
  const occasion = getOccasion(occasionKey);
  if (!occasion) return null;

  const resolved = await Promise.all(
    occasion.slots.map(async (slot) => {
      const product = await pickProductForSlot(slot);
      return product ? { slot: slot.slot, label: slot.label, product } : null;
    }),
  );

  const items = resolved.filter((i): i is OutfitItem => i !== null);
  const totalPrice = items.reduce((sum, i) => sum + i.product.price, 0);
  const totalMrp = items.reduce((sum, i) => sum + i.product.mrp, 0);

  return { occasion, items, totalPrice, totalMrp };
}
