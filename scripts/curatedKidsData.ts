/**
 * Curated data table for the newly-photographed Kids batch (T-Shirts, Shorts, Hoodies, Shirts,
 * Jeans, Party Wear, Joggers, Jackets, School Uniform) — see scripts/seedCuratedKids.ts. Same
 * one-product-per-color-per-code pattern as curatedApparelData.ts — see that file's docstring for
 * the reasoning.
 *
 * `sku` is the on-disk folder/file code (matches productImageManifest.ts keys exactly) and is also
 * what's stored in Firestore's `sku` field for every item here (no disambiguation needed — none of
 * these codes collide with any other curated batch's SKUs).
 */
export interface CuratedKidsItem {
  sku: string;
  categorySlug: string;
  folderKey: string;
  name: string;
  color: string;
  colorHex: string;
  /** Defaults to a round-robin kids-focused brand in the seed script when omitted. */
  brandSlug?: string;
}

const CEDIVE_SHORTS_NAME = 'CEDIVE Boys Printed Cotton Shorts';
const OVERSIZED_TEE_NAME = 'Clothing Boys Oversized Cotton Printed T-Shirt | Round Neck | Short Sleeves | Casual Wear';
const SYMBOL_SHIRT_NAME = 'Symbol Boys Cotton Casual Shirt';
const SYMBOL_JOGGER_JEANS_NAME = 'Symbol Slim Fit Stretchable Jogger Jeans';

export const CURATED_KIDS: CuratedKidsItem[] = [
  // ───────────────────────────── T-SHIRTS ────────────────────────────────────────────────────
  {
    sku: 'KT001',
    categorySlug: 'kids-tshirts',
    folderKey: 'tshirts',
    name: 'Typographic Printed Cotton Blend Half Sleeve T-Shirt for Boys - Pack of 3',
    color: 'Burgundy / Beige / Navy Blue',
    colorHex: '#6D2130',
  },
  { sku: 'KT002', categorySlug: 'kids-tshirts', folderKey: 'tshirts', name: OVERSIZED_TEE_NAME, color: 'Anthracite Grey', colorHex: '#383E42' },
  { sku: 'KT003', categorySlug: 'kids-tshirts', folderKey: 'tshirts', name: OVERSIZED_TEE_NAME, color: 'Blue', colorHex: '#3B6EA5' },
  { sku: 'KT004', categorySlug: 'kids-tshirts', folderKey: 'tshirts', name: OVERSIZED_TEE_NAME, color: 'Dark Charcoal', colorHex: '#2B2B2B' },
  {
    sku: 'KT005',
    categorySlug: 'kids-tshirts',
    folderKey: 'tshirts',
    name: 'Kids Round Neck Boys T-Shirt | Natural Organic 100% Cotton | Half Sleeve',
    color: 'White',
    colorHex: '#F5F5F0',
  },

  // ───────────────────────────── SHORTS ──────────────────────────────────────────────────────
  { sku: 'KS001', categorySlug: 'kids-shorts', folderKey: 'shorts', name: CEDIVE_SHORTS_NAME, color: 'Red', colorHex: '#B3231C' },
  { sku: 'KS002', categorySlug: 'kids-shorts', folderKey: 'shorts', name: CEDIVE_SHORTS_NAME, color: 'Yellow', colorHex: '#E0B400' },
  { sku: 'KS003', categorySlug: 'kids-shorts', folderKey: 'shorts', name: CEDIVE_SHORTS_NAME, color: 'Blue', colorHex: '#3B6EA5' },
  { sku: 'KS004', categorySlug: 'kids-shorts', folderKey: 'shorts', name: CEDIVE_SHORTS_NAME, color: 'Black', colorHex: '#1A1A1A' },
  { sku: 'KS005', categorySlug: 'kids-shorts', folderKey: 'shorts', name: CEDIVE_SHORTS_NAME, color: 'Yellow', colorHex: '#E0B400' },
  { sku: 'KS006', categorySlug: 'kids-shorts', folderKey: 'shorts', name: CEDIVE_SHORTS_NAME, color: 'Grey', colorHex: '#8A8F94' },
  { sku: 'KS007', categorySlug: 'kids-shorts', folderKey: 'shorts', name: CEDIVE_SHORTS_NAME, color: 'Black', colorHex: '#1A1A1A' },

  // ───────────────────────────── HOODIES ─────────────────────────────────────────────────────
  { sku: 'KH001', categorySlug: 'kids-hoodies', folderKey: 'hoodies', name: 'Boys Winter Wear Hooded Sweatshirt', color: 'Black', colorHex: '#1A1A1A' },
  { sku: 'KH002', categorySlug: 'kids-hoodies', folderKey: 'hoodies', name: 'Alan Jones Oversize Hoodie', color: 'Ecru', colorHex: '#E8E0CF' },
  { sku: 'KH003', categorySlug: 'kids-hoodies', folderKey: 'hoodies', name: 'Cotton Hooded Printed Oversize Hoodie', color: 'Black', colorHex: '#1A1A1A' },
  { sku: 'KH004', categorySlug: 'kids-hoodies', folderKey: 'hoodies', name: 'Boys Oversize Hoodie with Graffiti Print', color: 'Anthracite Grey', colorHex: '#383E42' },
  { sku: 'KH005', categorySlug: 'kids-hoodies', folderKey: 'hoodies', name: 'Alan Jones Printed Hoodie', color: 'Orange', colorHex: '#D9641E' },

  // ───────────────────────────── SHIRTS ──────────────────────────────────────────────────────
  { sku: 'KSH001', categorySlug: 'kids-shirts', folderKey: 'shirts', name: SYMBOL_SHIRT_NAME, color: 'White', colorHex: '#F5F5F0' },
  { sku: 'KSH002', categorySlug: 'kids-shirts', folderKey: 'shirts', name: SYMBOL_SHIRT_NAME, color: 'Granite Green', colorHex: '#4C5B4A' },
  { sku: 'KSH003', categorySlug: 'kids-shirts', folderKey: 'shirts', name: 'Kids Cotton Full Sleeve Shirt', color: 'Sky', colorHex: '#87CEEB' },
  { sku: 'KSH004', categorySlug: 'kids-shirts', folderKey: 'shirts', name: 'Tagas Boys Casual Shirt', color: 'Sky', colorHex: '#87CEEB' },
  { sku: 'KSH005', categorySlug: 'kids-shirts', folderKey: 'shirts', name: 'Red Nine Rocket Science Boys Shirt', color: 'Maroon', colorHex: '#6D2130' },
  { sku: 'KSH006', categorySlug: 'kids-shirts', folderKey: 'shirts', name: 'Red Nine Rocket Science Cotton Shirt', color: 'Peach', colorHex: '#F4C2A1' },
  { sku: 'KSH007', categorySlug: 'kids-shirts', folderKey: 'shirts', name: 'Lymio Junior Cotton Shirt', color: 'Brown', colorHex: '#5A3D2B' },

  // ───────────────────────────── JEANS ───────────────────────────────────────────────────────
  { sku: 'KJN001', categorySlug: 'kids-jeans', folderKey: 'jeans', name: SYMBOL_JOGGER_JEANS_NAME, color: 'Medium Blue', colorHex: '#4169A0' },
  { sku: 'KJN002', categorySlug: 'kids-jeans', folderKey: 'jeans', name: SYMBOL_JOGGER_JEANS_NAME, color: 'Light Blue', colorHex: '#A7C6DA' },
  { sku: 'KJN003', categorySlug: 'kids-jeans', folderKey: 'jeans', name: 'Junior Denim Baggy Jeans', color: 'Dark Blue', colorHex: '#1E3A5F' },
  { sku: 'KJN004', categorySlug: 'kids-jeans', folderKey: 'jeans', name: 'Toddler Cartoon Denim Joggers', color: 'Blue', colorHex: '#3B6EA5' },
  { sku: 'KJN005', categorySlug: 'kids-jeans', folderKey: 'jeans', name: 'Boys Elastic Waist Denim Jeans', color: 'Light Blue', colorHex: '#A7C6DA' },

  // ───────────────────────────── PARTY WEAR ──────────────────────────────────────────────────
  { sku: 'KP001', categorySlug: 'kids-party-wear', folderKey: 'Party Wear', name: '5 Piece Boys Suit Set', color: 'Navy Blue', colorHex: '#1E3A5F' },
  { sku: 'KP002', categorySlug: 'kids-party-wear', folderKey: 'Party Wear', name: 'Velvet Indo-Western Set', color: 'Wine', colorHex: '#5E1A29' },
  { sku: 'KP003', categorySlug: 'kids-party-wear', folderKey: 'Party Wear', name: 'Denim Vest Jacket Party Set', color: 'White', colorHex: '#F5F5F0' },
  { sku: 'KP004', categorySlug: 'kids-party-wear', folderKey: 'Party Wear', name: 'Boys Dhoti Kurta Sherwani Set', color: 'Blue', colorHex: '#3B6EA5' },
  { sku: 'KP005', categorySlug: 'kids-party-wear', folderKey: 'Party Wear', name: 'Ethnic Shirt Shorts with Bow Tie', color: 'White', colorHex: '#F5F5F0' },
  { sku: 'KP006', categorySlug: 'kids-party-wear', folderKey: 'Party Wear', name: 'AJ DEZINES Chikankari Kurta', color: 'Yellow', colorHex: '#E0B400' },

  // ───────────────────────────── JOGGERS ─────────────────────────────────────────────────────
  { sku: 'KJ001', categorySlug: 'kids-joggers', folderKey: 'Joggers', name: 'Anime Jogger Pants', color: 'Tribal', colorHex: '#7A4A2B' },
  { sku: 'KJ002', categorySlug: 'kids-joggers', folderKey: 'Joggers', name: 'Boys Cotton Cargo Joggers', color: 'Blue', colorHex: '#3B6EA5' },
  { sku: 'KJ003', categorySlug: 'kids-joggers', folderKey: 'Joggers', name: 'Classic Cotton Cargo Pants', color: 'Cream', colorHex: '#F0E6D2' },

  // ───────────────────────────── JACKETS ─────────────────────────────────────────────────────
  { sku: 'KJK001', categorySlug: 'kids-jackets', folderKey: 'jackets', name: 'Hooded Fleece Zip-Up Jacket', color: 'Black', colorHex: '#1A1A1A' },
  { sku: 'KJK002', categorySlug: 'kids-jackets', folderKey: 'jackets', name: 'Cotton Denim Jacket', color: 'Navy Blue', colorHex: '#1E3A5F' },
  { sku: 'KJK003', categorySlug: 'kids-jackets', folderKey: 'jackets', name: 'Corduroy Winter Jacket', color: 'Green', colorHex: '#3F6B4F' },
  { sku: 'KJK004', categorySlug: 'kids-jackets', folderKey: 'jackets', name: 'Tagas Winter Jacket', color: 'Black', colorHex: '#1A1A1A' },
  { sku: 'KJK005', categorySlug: 'kids-jackets', folderKey: 'jackets', name: 'LA Printed Varsity Jacket', color: 'Black', colorHex: '#1A1A1A' },

  // ───────────────────────────── SCHOOL UNIFORM ──────────────────────────────────────────────
  { sku: 'KSU001', categorySlug: 'school-uniform', folderKey: 'School Uniform', name: 'Boys School Uniform Set', color: 'Yellow', colorHex: '#E0B400' },
  { sku: 'KSU002', categorySlug: 'school-uniform', folderKey: 'School Uniform', name: 'Kendriya Vidyalaya Polo T-Shirt', color: 'Green', colorHex: '#3F6B4F' },
  { sku: 'KSU003', categorySlug: 'school-uniform', folderKey: 'School Uniform', name: 'Kendriya Vidyalaya Half Sleeve Uniform Shirt', color: 'KV Check', colorHex: '#4C5B4A' },
];
