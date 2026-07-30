/**
 * Shared data table for the curated Shirts/T-Shirts batch (Casual, Printed, Solid, Cotton shirts +
 * Polo, Round Neck, Oversized, Henley t-shirts). Each entry is ONE product with ONE primary color,
 * matching the literal schema the request specified (products/{code} → { color, images: [...] }) —
 * real marketplace listings that come in several colorways (e.g. the same "Indian Garage Co..."
 * shirt in 7 colors) are represented as several same-named documents, one per colorway, rather than
 * merged into a single multi-variant product, so each stays a clean 1:1 with its own code and photo
 * folder.
 *
 * `sku` is the folder/file code on disk (matches scripts/data/productImageManifest.ts keys exactly)
 * and, for every item here, also what's stored in Firestore's `sku` field (`displaySku === sku`).
 * The Casual Shirts (CS001-CS007) previously used a disambiguated `displaySku` of CAS00N because
 * those codes belonged to a separate curated "Checked Shirts" product line — that line has since
 * been retired, so CS001-CS007 now belongs solely to Casual Shirts.
 */
export interface CuratedShirtItem {
  sku: string;
  displaySku: string;
  categorySlug: string;
  folderKey: string;
  kind: 'shirt' | 'tshirt';
  name: string;
  color: string;
  colorHex: string;
  /** Only set for the curated Shirts batch (Casual/Printed/Solid/Cotton) — must match a slug in
   *  BRAND_DEFS. T-shirt items omit this and fall back to the seed script's random brand pool. */
  brandSlug?: string;
}

const CASUAL_SHIRT_NAME = "Men's Casual Shirt";
const CASUAL_SHIRT_CS007_NAME = 'The Indian Garage Co Men Slim Fit Checkered Full Sleeves Spread Collar Casual Shirt';
const URBANO_SOLID_NAME = 'Urbano Fashion Solid Shirt';

export const CURATED_SHIRTS_TSHIRTS: CuratedShirtItem[] = [
  // ───────────────────────────── CASUAL SHIRTS ───────────────────────────────────────────────────
  { sku: 'CS001', displaySku: 'CS001', categorySlug: 'casual-shirts', folderKey: 'casual-shirts', kind: 'shirt', name: CASUAL_SHIRT_NAME, color: 'Grey', colorHex: '#A6A9AC', brandSlug: 'dressmart-collection' },
  { sku: 'CS002', displaySku: 'CS002', categorySlug: 'casual-shirts', folderKey: 'casual-shirts', kind: 'shirt', name: CASUAL_SHIRT_NAME, color: 'Mist Green', colorHex: '#B8C9B0', brandSlug: 'dressmart-collection' },
  { sku: 'CS003', displaySku: 'CS003', categorySlug: 'casual-shirts', folderKey: 'casual-shirts', kind: 'shirt', name: CASUAL_SHIRT_NAME, color: 'Green & White', colorHex: '#4E7A4E', brandSlug: 'dressmart-collection' },
  { sku: 'CS004', displaySku: 'CS004', categorySlug: 'casual-shirts', folderKey: 'casual-shirts', kind: 'shirt', name: CASUAL_SHIRT_NAME, color: 'Brown', colorHex: '#5A3E2B', brandSlug: 'dressmart-collection' },
  { sku: 'CS005', displaySku: 'CS005', categorySlug: 'casual-shirts', folderKey: 'casual-shirts', kind: 'shirt', name: CASUAL_SHIRT_NAME, color: 'Cloud White', colorHex: '#F5F5F0', brandSlug: 'dressmart-collection' },
  { sku: 'CS006', displaySku: 'CS006', categorySlug: 'casual-shirts', folderKey: 'casual-shirts', kind: 'shirt', name: CASUAL_SHIRT_NAME, color: 'Khaki', colorHex: '#C3A868', brandSlug: 'dressmart-collection' },
  { sku: 'CS007', displaySku: 'CS007', categorySlug: 'casual-shirts', folderKey: 'casual-shirts', kind: 'shirt', name: CASUAL_SHIRT_CS007_NAME, color: 'Navy Blue', colorHex: '#1B2A4A', brandSlug: 'the-indian-garage-co' },

  // ───────────────────────────── PRINTED SHIRTS ──────────────────────────────────────────────────
  { sku: 'PS001', displaySku: 'PS001', categorySlug: 'printed-shirts', folderKey: 'Printed-Shirts', kind: 'shirt', name: "Thomas Scott Men's Printed Full Sleeve Regular Fit Cotton Mandarin Collar Shirt", color: 'Sky Blue', colorHex: '#8FC1E3', brandSlug: 'thomas-scott' },
  { sku: 'PS002', displaySku: 'PS002', categorySlug: 'printed-shirts', folderKey: 'Printed-Shirts', kind: 'shirt', name: 'DHRUVI TRENDZ Tropical Printed Hawaiian Shirt', color: 'Sky', colorHex: '#A9CDE8', brandSlug: 'dhruvi-trendz' },
  { sku: 'PS003', displaySku: 'PS003', categorySlug: 'printed-shirts', folderKey: 'Printed-Shirts', kind: 'shirt', name: "Men's Designer Paisley Printed Shirt", color: 'Green Keri', colorHex: '#A9B84C', brandSlug: 'dressmart-collection' },
  { sku: 'PS004', displaySku: 'PS004', categorySlug: 'printed-shirts', folderKey: 'Printed-Shirts', kind: 'shirt', name: 'ZEROYAA Hipster Printed Satin Shirt', color: 'Green', colorHex: '#4E7A4E', brandSlug: 'zeroyaa' },
  { sku: 'PS005', displaySku: 'PS005', categorySlug: 'printed-shirts', folderKey: 'Printed-Shirts', kind: 'shirt', name: 'Black Mufasa Embroidered Premium Cotton Shirt', color: 'Black Golden', colorHex: '#1C1C1C', brandSlug: 'dressmart-collection' },
  { sku: 'PS006', displaySku: 'PS006', categorySlug: 'printed-shirts', folderKey: 'Printed-Shirts', kind: 'shirt', name: 'Geometric Print Cotton Blend Shirt', color: 'Multicoloured', colorHex: '#C0392B', brandSlug: 'dressmart-collection' },
  { sku: 'PS007', displaySku: 'PS007', categorySlug: 'printed-shirts', folderKey: 'Printed-Shirts', kind: 'shirt', name: 'Printed Short Kurta Shirt', color: 'Yellow Print', colorHex: '#E8D95A', brandSlug: 'dressmart-collection' },

  // ───────────────────────────── SOLID SHIRTS ────────────────────────────────────────────────────
  { sku: 'SS001', displaySku: 'SS001', categorySlug: 'solid-shirts', folderKey: 'Solid-Shirts', kind: 'shirt', name: 'StitchX Cotton Pique Regular Fit Knitted Shirt', color: 'Burgundy Coffee', colorHex: '#5E1B27', brandSlug: 'stitchx' },
  { sku: 'SS002', displaySku: 'SS002', categorySlug: 'solid-shirts', folderKey: 'Solid-Shirts', kind: 'shirt', name: 'StitchX Mandarin Collar Shirt', color: 'Olive Green', colorHex: '#6B6E3A', brandSlug: 'stitchx' },
  { sku: 'SS003', displaySku: 'SS003', categorySlug: 'solid-shirts', folderKey: 'Solid-Shirts', kind: 'shirt', name: URBANO_SOLID_NAME, color: 'Olive', colorHex: '#6B6E3A', brandSlug: 'urbano-fashion' },
  { sku: 'SS004', displaySku: 'SS004', categorySlug: 'solid-shirts', folderKey: 'Solid-Shirts', kind: 'shirt', name: URBANO_SOLID_NAME, color: 'Maroon', colorHex: '#6B1F2B', brandSlug: 'urbano-fashion' },
  { sku: 'SS005', displaySku: 'SS005', categorySlug: 'solid-shirts', folderKey: 'Solid-Shirts', kind: 'shirt', name: URBANO_SOLID_NAME, color: 'Pink', colorHex: '#F0A8B8', brandSlug: 'urbano-fashion' },
  { sku: 'SS006', displaySku: 'SS006', categorySlug: 'solid-shirts', folderKey: 'Solid-Shirts', kind: 'shirt', name: 'Peter England Everyday Solid Slim Fit Shirt', color: 'Navy', colorHex: '#1B2A4A', brandSlug: 'peter-england' },

  // ───────────────────────────── COTTON SHIRTS ───────────────────────────────────────────────────
  { sku: 'CT001', displaySku: 'CT001', categorySlug: 'cotton-shirts', folderKey: 'Cotton-Shirts', kind: 'shirt', name: 'Diverse Premium Poly Cotton Shirt', color: 'Lavender', colorHex: '#B6A0C9', brandSlug: 'diverse' },
  { sku: 'CT002', displaySku: 'CT002', categorySlug: 'cotton-shirts', folderKey: 'Cotton-Shirts', kind: 'shirt', name: 'Amazon Brand Symbol Cotton Shirt', color: 'Olive', colorHex: '#6B6E3A', brandSlug: 'symbol' },
  { sku: 'CT003', displaySku: 'CT003', categorySlug: 'cotton-shirts', folderKey: 'Cotton-Shirts', kind: 'shirt', name: 'Symbol Cotton Formal Shirt', color: 'Aqua', colorHex: '#7FC7C2', brandSlug: 'symbol' },
  { sku: 'CT004', displaySku: 'CT004', categorySlug: 'cotton-shirts', folderKey: 'Cotton-Shirts', kind: 'shirt', name: "Men's Cotton Regular Fit Shirt", color: 'Maroon', colorHex: '#6B1F2B', brandSlug: 'dressmart-collection' },
  { sku: 'CT005', displaySku: 'CT005', categorySlug: 'cotton-shirts', folderKey: 'Cotton-Shirts', kind: 'shirt', name: 'Regular Fit Cotton Shirt', color: 'Khaki Brown', colorHex: '#8A6D3A', brandSlug: 'dressmart-collection' },

  // ───────────────────────────── POLO T-SHIRTS ───────────────────────────────────────────────────
  { sku: 'PT001', displaySku: 'PT001', categorySlug: 'polo-tshirts', folderKey: 'polo-tshirts', kind: 'tshirt', name: "Allen Solly Men's Polo T-Shirt Cotton Blend Band Collar Regular Fit", color: 'Sea Green', colorHex: '#4E8B7C' },
  { sku: 'PT002', displaySku: 'PT002', categorySlug: 'polo-tshirts', folderKey: 'polo-tshirts', kind: 'tshirt', name: 'Misty Lilac Polo T-Shirt', color: 'Misty Lilac', colorHex: '#C9B8D9' },
  { sku: 'PT003', displaySku: 'PT003', categorySlug: 'polo-tshirts', folderKey: 'polo-tshirts', kind: 'tshirt', name: 'Two-Tone Black & Brown Polo T-Shirt', color: 'Black & Brown', colorHex: '#1C1C1C' },
  { sku: 'PT004', displaySku: 'PT004', categorySlug: 'polo-tshirts', folderKey: 'polo-tshirts', kind: 'tshirt', name: 'Espresso Brown Polo T-Shirt', color: 'Espresso Brown', colorHex: '#3E2A1C' },
  { sku: 'PT005', displaySku: 'PT005', categorySlug: 'polo-tshirts', folderKey: 'polo-tshirts', kind: 'tshirt', name: 'Classic White Polo T-Shirt', color: 'White', colorHex: '#FFFFFF' },
  { sku: 'PT006', displaySku: 'PT006', categorySlug: 'polo-tshirts', folderKey: 'polo-tshirts', kind: 'tshirt', name: 'Fresh Green Polo T-Shirt', color: 'Green', colorHex: '#4E7A4E' },
  { sku: 'PT007', displaySku: 'PT007', categorySlug: 'polo-tshirts', folderKey: 'polo-tshirts', kind: 'tshirt', name: 'Black-Blue Colorblock Polo T-Shirt', color: 'Black-Blue', colorHex: '#1C1C1C' },
  { sku: 'PT008', displaySku: 'PT008', categorySlug: 'polo-tshirts', folderKey: 'polo-tshirts', kind: 'tshirt', name: 'Everyday Beige Polo T-Shirt', color: 'Beige', colorHex: '#D8C9AE' },
  { sku: 'PT009', displaySku: 'PT009', categorySlug: 'polo-tshirts', folderKey: 'polo-tshirts', kind: 'tshirt', name: 'Vibrant Teal Polo T-Shirt', color: 'Teal', colorHex: '#1F6F6B' },
  { sku: 'PT010', displaySku: 'PT010', categorySlug: 'polo-tshirts', folderKey: 'polo-tshirts', kind: 'tshirt', name: 'Essential Black Polo T-Shirt', color: 'Black', colorHex: '#1C1C1C' },

  // ───────────────────────────── ROUND NECK T-SHIRTS ─────────────────────────────────────────────
  { sku: 'RN001', displaySku: 'RN001', categorySlug: 'round-neck-tshirts', folderKey: 'Round Neck T-Shirts', kind: 'tshirt', name: 'Pure White Round Neck T-Shirt', color: 'Pure White', colorHex: '#FFFFFF' },
  { sku: 'RN002', displaySku: 'RN002', categorySlug: 'round-neck-tshirts', folderKey: 'Round Neck T-Shirts', kind: 'tshirt', name: 'Classic Navy Round Neck T-Shirt', color: 'Navy', colorHex: '#1B2A4A' },
  { sku: 'RN003', displaySku: 'RN003', categorySlug: 'round-neck-tshirts', folderKey: 'Round Neck T-Shirts', kind: 'tshirt', name: 'Symbol Men Regular Fit T-Shirt Pack of 2', color: 'Mid Grey Melange & Jet Black', colorHex: '#8B8F94' },
  { sku: 'RN004', displaySku: 'RN004', categorySlug: 'round-neck-tshirts', folderKey: 'Round Neck T-Shirts', kind: 'tshirt', name: 'Milky Brown Round Neck T-Shirt', color: 'Milky Brown', colorHex: '#B08968' },
  { sku: 'RN005', displaySku: 'RN005', categorySlug: 'round-neck-tshirts', folderKey: 'Round Neck T-Shirts', kind: 'tshirt', name: 'Everyday Navy Round Neck T-Shirt', color: 'Navy', colorHex: '#1B2A4A' },
  { sku: 'RN006', displaySku: 'RN006', categorySlug: 'round-neck-tshirts', folderKey: 'Round Neck T-Shirts', kind: 'tshirt', name: 'Ecru Olive Round Neck T-Shirt', color: 'Ecru Olive', colorHex: '#ADA378' },
  { sku: 'RN007', displaySku: 'RN007', categorySlug: 'round-neck-tshirts', folderKey: 'Round Neck T-Shirts', kind: 'tshirt', name: 'Printed Cotton Blend Crew Neck T-Shirt Pack of 3', color: 'Brick / Bluish Grey / Navy Blue', colorHex: '#B7410E' },
  { sku: 'RN008', displaySku: 'RN008', categorySlug: 'round-neck-tshirts', folderKey: 'Round Neck T-Shirts', kind: 'tshirt', name: 'Fresh Green Round Neck T-Shirt', color: 'Green', colorHex: '#4E7A4E' },

  // ───────────────────────────── OVERSIZED T-SHIRTS (no names given — generated) ─────────────────
  { sku: 'OS001', displaySku: 'OS001', categorySlug: 'oversized-tshirts', folderKey: 'Oversized T-Shirts', kind: 'tshirt', name: 'Oversized Black Drop-Shoulder T-Shirt', color: 'Black-519159', colorHex: '#1C1C1C' },
  { sku: 'OS002', displaySku: 'OS002', categorySlug: 'oversized-tshirts', folderKey: 'Oversized T-Shirts', kind: 'tshirt', name: 'Bold Red Oversized T-Shirt', color: 'Red', colorHex: '#C0202B' },
  { sku: 'OS003', displaySku: 'OS003', categorySlug: 'oversized-tshirts', folderKey: 'Oversized T-Shirts', kind: 'tshirt', name: 'Jet Black Oversized T-Shirt', color: 'Jet Black', colorHex: '#1A1A1A' },
  { sku: 'OS004', displaySku: 'OS004', categorySlug: 'oversized-tshirts', folderKey: 'Oversized T-Shirts', kind: 'tshirt', name: 'Aventurine Oversized T-Shirt', color: 'Aventurine', colorHex: '#6FA287' },
  { sku: 'OS005', displaySku: 'OS005', categorySlug: 'oversized-tshirts', folderKey: 'Oversized T-Shirts', kind: 'tshirt', name: 'Roan Rogue Pink Oversized T-Shirt', color: 'Roan Rogue Pink', colorHex: '#D46A8A' },
  { sku: 'OS006', displaySku: 'OS006', categorySlug: 'oversized-tshirts', folderKey: 'Oversized T-Shirts', kind: 'tshirt', name: 'Classic Maroon Oversized T-Shirt', color: 'Maroon', colorHex: '#6B1F2B' },
  { sku: 'OS007', displaySku: 'OS007', categorySlug: 'oversized-tshirts', folderKey: 'Oversized T-Shirts', kind: 'tshirt', name: 'Coco Brown Oversized T-Shirt', color: 'Coco Brown', colorHex: '#6F4E37' },
  { sku: 'OS008', displaySku: 'OS008', categorySlug: 'oversized-tshirts', folderKey: 'Oversized T-Shirts', kind: 'tshirt', name: 'Heather Grey Oversized T-Shirt', color: 'Grey', colorHex: '#A6A9AC' },

  // ───────────────────────────── HENLEY T-SHIRTS (no names given — generated) ───────────────────
  { sku: 'HT001', displaySku: 'HT001', categorySlug: 'henley-tshirts', folderKey: 'Henley T-Shirts', kind: 'tshirt', name: 'Coffee Brown Henley T-Shirt', color: 'Coffee Brown', colorHex: '#4A2E1F' },
  { sku: 'HT002', displaySku: 'HT002', categorySlug: 'henley-tshirts', folderKey: 'Henley T-Shirts', kind: 'tshirt', name: 'Soft Pink Henley T-Shirt', color: 'Pink', colorHex: '#F0A8B8' },
  { sku: 'HT003', displaySku: 'HT003', categorySlug: 'henley-tshirts', folderKey: 'Henley T-Shirts', kind: 'tshirt', name: 'Teal Henley T-Shirt', color: 'Teal', colorHex: '#1F6F6B' },
  { sku: 'HT004', displaySku: 'HT004', categorySlug: 'henley-tshirts', folderKey: 'Henley T-Shirts', kind: 'tshirt', name: 'Off White Henley T-Shirt', color: 'Off White', colorHex: '#F0EDE4' },
  { sku: 'HT005', displaySku: 'HT005', categorySlug: 'henley-tshirts', folderKey: 'Henley T-Shirts', kind: 'tshirt', name: 'Classic Off White Henley T-Shirt', color: 'Off White', colorHex: '#F0EDE4' },
  { sku: 'HT006', displaySku: 'HT006', categorySlug: 'henley-tshirts', folderKey: 'Henley T-Shirts', kind: 'tshirt', name: 'Classic Brown Henley T-Shirt', color: 'Brown', colorHex: '#5A3E2B' },
];
