/**
 * Shared data table for the 30 hand-specified curated Checked Shirt products (CS001-CS030),
 * consumed by both scripts/generateCuratedCheckedShirtImages.ts (produces the actual placeholder
 * image files) and scripts/seedCuratedCheckedShirts.ts (writes the Firestore product docs) — kept as
 * one typed source of truth so the two never drift out of sync.
 */
export interface CuratedCheckedShirt {
  sku: string;
  name: string;
  /** Display color label — must exactly match what the user specified. */
  color: string;
  base: string;
  accent: string;
  /** Only set for CS030 (Multicolour) — genuinely mixes more than two tones. */
  third?: string;
  fourth?: string;
}

export const CURATED_CHECKED_SHIRTS: CuratedCheckedShirt[] = [
  { sku: 'CS001', name: 'Classic White Check Cotton Shirt', color: 'White', base: '#FFFFFF', accent: '#D9D9D9' },
  { sku: 'CS002', name: 'Urban Grid Checked Shirt', color: 'Light Grey/White', base: '#D9D9D9', accent: '#FFFFFF' },
  { sku: 'CS003', name: 'Monochrome Plaid Shirt', color: 'Black/White', base: '#1C1C1C', accent: '#FFFFFF' },
  { sku: 'CS004', name: 'Forest Mist Checked Shirt', color: 'Dusty Green/White', base: '#8A9A8A', accent: '#FFFFFF' },
  { sku: 'CS005', name: 'Blush Check Casual Shirt', color: 'Light Pink/White', base: '#F3C9D3', accent: '#FFFFFF' },
  { sku: 'CS006', name: 'Aqua Breeze Checked Shirt', color: 'Aqua', base: '#3FBFBF', accent: '#2A8F8F' },
  { sku: 'CS007', name: 'Woodland Check Shirt', color: 'Dark Green', base: '#1F4A2E', accent: '#14311F' },
  { sku: 'CS008', name: 'Olive Grove Checked Shirt', color: 'Olive', base: '#6B6E3A', accent: '#52542C' },
  { sku: 'CS009', name: 'Heritage Buffalo Check Shirt', color: 'Black & White', base: '#1C1C1C', accent: '#FFFFFF' },
  { sku: 'CS010', name: 'Golden Plaid Casual Shirt', color: 'Black & Yellow', base: '#1C1C1C', accent: '#D4AF13' },
  { sku: 'CS011', name: 'Ocean Blue Checked Shirt', color: 'Blue', base: '#2F5C8A', accent: '#1E3E5C' },
  { sku: 'CS012', name: 'Contrast Check Shirt', color: 'White Black', base: '#FFFFFF', accent: '#1C1C1C' },
  { sku: 'CS013', name: 'Rustic Brown Check Shirt', color: 'Brown', base: '#6B4A32', accent: '#503620' },
  { sku: 'CS014', name: 'Midnight Check Shirt', color: 'Black', base: '#1A1A1A', accent: '#333333' },
  { sku: 'CS015', name: 'Espresso Checked Shirt', color: 'Dark Brown', base: '#4A2E1F', accent: '#331F15' },
  { sku: 'CS016', name: 'Emerald Classic Check Shirt', color: 'Dark Green', base: '#1F4A2E', accent: '#14311F' },
  { sku: 'CS017', name: 'Emerald Premium Check Shirt', color: 'Dark Green', base: '#234F32', accent: '#16331F' },
  { sku: 'CS018', name: 'Shadow Check Shirt', color: 'Black Grey', base: '#2B2B2E', accent: '#6B6E73' },
  { sku: 'CS019', name: 'Bottle Green Beige Plaid Shirt', color: 'Bottle Green Beige', base: '#1F4A34', accent: '#D8C9AE' },
  { sku: 'CS020', name: 'Coffee House Check Shirt', color: 'Deep Brown', base: '#3E2A1C', accent: '#2A1B11' },
  { sku: 'CS021', name: 'Steel Grey Checked Shirt', color: 'Grey', base: '#71767C', accent: '#52565B' },
  { sku: 'CS022', name: 'Navy Fusion Check Shirt', color: 'Navy Grey', base: '#1B2A4A', accent: '#6B6E73' },
  { sku: 'CS023', name: 'Arctic Grey Check Shirt', color: 'White Grey', base: '#F0F0F0', accent: '#A6A9AC' },
  { sku: 'CS024', name: 'Royal Wine Checked Shirt', color: 'Wine', base: '#5E1B27', accent: '#7A2E3A' },
  { sku: 'CS025', name: 'Clay Earth Checked Shirt', color: 'Clay', base: '#B2664D', accent: '#8C4E3A' },
  { sku: 'CS026', name: 'Royal Purple Plaid Shirt', color: 'Purple-White', base: '#6A3B6E', accent: '#FFFFFF' },
  { sku: 'CS027', name: 'Sandstone Check Shirt', color: 'Beige', base: '#D8C9AE', accent: '#C2AE8C' },
  { sku: 'CS028', name: 'Mint Fresh Checked Shirt', color: 'Mint', base: '#A8D5BA', accent: '#7FBF9A' },
  { sku: 'CS029', name: 'Lemon Twist Checked Shirt', color: 'Lemon', base: '#E8D95A', accent: '#D4C13F' },
  {
    sku: 'CS030',
    name: 'Vibrant Multicolor Checked Shirt',
    color: 'Multicolour',
    base: '#C0392B',
    accent: '#2980B9',
    third: '#E8D95A',
    fourth: '#1F4A2E',
  },
];
