/**
 * Curated data table for the newly-photographed Bottom Wear, Outerwear, Ethnic Wear, Innerwear,
 * Belts, and Vests batch. Same one-product-per-color-per-code pattern as
 * curatedShirtsTshirtsData.ts — see that file's docstring for the reasoning.
 *
 * `sku` is the on-disk folder/file code (matches productImageManifest.ts keys exactly) and is
 * also what's stored in Firestore's `sku` field for every item here (no disambiguation needed —
 * none of these codes collide with any other curated batch's SKUs).
 */
export interface CuratedApparelItem {
  sku: string;
  categorySlug: string;
  folderKey: string;
  name: string;
  color: string;
  colorHex: string;
  /** Defaults to 'dressmart-collection' in the seed script when omitted. */
  brandSlug?: string;
}

const SLIM_JEANS_NAME = "Men's Slim Fit Jeans";
const REGULAR_JEANS_NAME = "Men's Regular Fit Jeans";
const CARGO_PANTS_NAME = "Men's Cargo Pants";
const JOGGERS_NAME = "Men's Jogger Pants";
const SHORTS_NAME = 'Mens 2 Pack Polyester Yoga Shorts with Pockets';
const FORMAL_PANTS_NAME = "Men's Formal Trousers";
const BLAZER_NAME = "Men's Blazer";
const JACKET_NAME = "Men's Jacket";
const HOODIE_NAME = "Men's Hoodie";
const SWEATSHIRT_NAME = "Men's Sweatshirt";
const KURTA_NAME = "Men's Kurta";
const SHERWANI_NAME = "Men's Sherwani";
const INNERWEAR_NAME = "Axe & Hammer Men's Trunk";
const BELT_NAME = "Men's Leather Belt";
const VEST_NAME = "Men's Cotton Vest";

export const CURATED_APPAREL: CuratedApparelItem[] = [
  // ───────────────────────────── SLIM JEANS ──────────────────────────────────────────────────
  { sku: 'SJ001', categorySlug: 'slim-jeans', folderKey: 'Slim Jeans', name: SLIM_JEANS_NAME, color: 'Mid Indigo', colorHex: '#3E5C76' },
  { sku: 'SJ002', categorySlug: 'slim-jeans', folderKey: 'Slim Jeans', name: SLIM_JEANS_NAME, color: 'Blue', colorHex: '#4169A0' },
  { sku: 'SJ003', categorySlug: 'slim-jeans', folderKey: 'Slim Jeans', name: SLIM_JEANS_NAME, color: 'Mid Blue', colorHex: '#3B6EA5' },
  { sku: 'SJ004', categorySlug: 'slim-jeans', folderKey: 'Slim Jeans', name: SLIM_JEANS_NAME, color: 'Washed Blue', colorHex: '#6F91B3' },
  { sku: 'SJ005', categorySlug: 'slim-jeans', folderKey: 'Slim Jeans', name: SLIM_JEANS_NAME, color: 'Ice Blue', colorHex: '#A9C6D8' },
  { sku: 'SJ006', categorySlug: 'slim-jeans', folderKey: 'Slim Jeans', name: SLIM_JEANS_NAME, color: 'Jet Black', colorHex: '#0D0D0D' },
  { sku: 'SJ007', categorySlug: 'slim-jeans', folderKey: 'Slim Jeans', name: SLIM_JEANS_NAME, color: 'Light Grey', colorHex: '#B8B8B8' },
  { sku: 'SJ008', categorySlug: 'slim-jeans', folderKey: 'Slim Jeans', name: SLIM_JEANS_NAME, color: 'Ice Blue', colorHex: '#A9C6D8' },
  { sku: 'SJ009', categorySlug: 'slim-jeans', folderKey: 'Slim Jeans', name: SLIM_JEANS_NAME, color: 'Khakee', colorHex: '#8A7A54' },
  { sku: 'SJ010', categorySlug: 'slim-jeans', folderKey: 'Slim Jeans', name: SLIM_JEANS_NAME, color: 'Light Green', colorHex: '#A8B78E' },
  { sku: 'SJ011', categorySlug: 'slim-jeans', folderKey: 'Slim Jeans', name: SLIM_JEANS_NAME, color: 'Grey Blue', colorHex: '#6E7F8D' },
  { sku: 'SJ012', categorySlug: 'slim-jeans', folderKey: 'Slim Jeans', name: SLIM_JEANS_NAME, color: 'Sky Blue', colorHex: '#8FB8DE' },
  { sku: 'SJ013', categorySlug: 'slim-jeans', folderKey: 'Slim Jeans', name: SLIM_JEANS_NAME, color: 'Distressed Blue', colorHex: '#A9C0D2' },

  // ───────────────────────────── REGULAR JEANS ───────────────────────────────────────────────
  { sku: 'RJ001', categorySlug: 'regular-jeans', folderKey: 'Regular Jeans', name: REGULAR_JEANS_NAME, color: 'Light Blue', colorHex: '#7FA8C9' },
  { sku: 'RJ002', categorySlug: 'regular-jeans', folderKey: 'Regular Jeans', name: REGULAR_JEANS_NAME, color: 'Dark Blue', colorHex: '#1F3A5F' },
  { sku: 'RJ003', categorySlug: 'regular-jeans', folderKey: 'Regular Jeans', name: REGULAR_JEANS_NAME, color: 'Dark Blue', colorHex: '#1F3A5F' },
  { sku: 'RJ004', categorySlug: 'regular-jeans', folderKey: 'Regular Jeans', name: REGULAR_JEANS_NAME, color: 'Black', colorHex: '#1A1A1A' },
  { sku: 'RJ005', categorySlug: 'regular-jeans', folderKey: 'Regular Jeans', name: REGULAR_JEANS_NAME, color: 'Light Blue', colorHex: '#7FA8C9' },
  { sku: 'RJ006', categorySlug: 'regular-jeans', folderKey: 'Regular Jeans', name: REGULAR_JEANS_NAME, color: 'Dark Grey', colorHex: '#4A4A4A' },
  { sku: 'RJ007', categorySlug: 'regular-jeans', folderKey: 'Regular Jeans', name: REGULAR_JEANS_NAME, color: 'Beige', colorHex: '#D8C9AE' },
  { sku: 'RJ008', categorySlug: 'regular-jeans', folderKey: 'Regular Jeans', name: REGULAR_JEANS_NAME, color: 'Blue', colorHex: '#3B6EA5' },

  // ───────────────────────────── CARGO PANTS ─────────────────────────────────────────────────
  { sku: 'CP001', categorySlug: 'cargo-pants', folderKey: 'Cargo Pants', name: CARGO_PANTS_NAME, color: 'Dark Olive', colorHex: '#4B4E33' },
  { sku: 'CP002', categorySlug: 'cargo-pants', folderKey: 'Cargo Pants', name: CARGO_PANTS_NAME, color: 'Awesome Fawn', colorHex: '#A9906D' },
  { sku: 'CP003', categorySlug: 'cargo-pants', folderKey: 'Cargo Pants', name: CARGO_PANTS_NAME, color: 'Dark Grey', colorHex: '#4A4A4A' },
  { sku: 'CP004', categorySlug: 'cargo-pants', folderKey: 'Cargo Pants', name: CARGO_PANTS_NAME, color: 'Beige', colorHex: '#D8C9AE' },
  { sku: 'CP005', categorySlug: 'cargo-pants', folderKey: 'Cargo Pants', name: CARGO_PANTS_NAME, color: 'Grey', colorHex: '#8A8A8A' },
  { sku: 'CP006', categorySlug: 'cargo-pants', folderKey: 'Cargo Pants', name: CARGO_PANTS_NAME, color: 'Creamy Tan', colorHex: '#C9AE84' },
  { sku: 'CP007', categorySlug: 'cargo-pants', folderKey: 'Cargo Pants', name: CARGO_PANTS_NAME, color: 'Black', colorHex: '#1A1A1A' },
  { sku: 'CP008', categorySlug: 'cargo-pants', folderKey: 'Cargo Pants', name: CARGO_PANTS_NAME, color: 'Pale Blue', colorHex: '#B8CCDD' },
  { sku: 'CP009', categorySlug: 'cargo-pants', folderKey: 'Cargo Pants', name: CARGO_PANTS_NAME, color: 'Light Blue', colorHex: '#7FA8C9' },
  { sku: 'CP010', categorySlug: 'cargo-pants', folderKey: 'Cargo Pants', name: CARGO_PANTS_NAME, color: 'Rust', colorHex: '#A6512C' },

  // ───────────────────────────── JOGGERS ─────────────────────────────────────────────────────
  { sku: 'JG001', categorySlug: 'joggers', folderKey: 'Joggers', name: JOGGERS_NAME, color: 'Deep Olive', colorHex: '#454B33' },
  { sku: 'JG002', categorySlug: 'joggers', folderKey: 'Joggers', name: JOGGERS_NAME, color: 'Navy Blue', colorHex: '#1B2A4A' },
  { sku: 'JG003', categorySlug: 'joggers', folderKey: 'Joggers', name: JOGGERS_NAME, color: 'Grey', colorHex: '#8A8A8A' },
  { sku: 'JG004', categorySlug: 'joggers', folderKey: 'Joggers', name: JOGGERS_NAME, color: 'Brown', colorHex: '#5A3E2B' },
  { sku: 'JG005', categorySlug: 'joggers', folderKey: 'Joggers', name: JOGGERS_NAME, color: 'Light Grey', colorHex: '#B8B8B8' },

  // ───────────────────────────── SHORTS ──────────────────────────────────────────────────────
  { sku: 'SH001', categorySlug: 'shorts', folderKey: 'Shorts', name: SHORTS_NAME, color: 'Performance Grey & Navy Moonstruck', colorHex: '#6E7580' },
  { sku: 'SH002', categorySlug: 'shorts', folderKey: 'Shorts', name: SHORTS_NAME, color: 'Black', colorHex: '#1A1A1A' },
  { sku: 'SH003', categorySlug: 'shorts', folderKey: 'Shorts', name: SHORTS_NAME, color: 'Green', colorHex: '#4E7A4E' },
  { sku: 'SH004', categorySlug: 'shorts', folderKey: 'Shorts', name: SHORTS_NAME, color: 'White', colorHex: '#F5F5F5' },
  { sku: 'SH005', categorySlug: 'shorts', folderKey: 'Shorts', name: SHORTS_NAME, color: 'Dark Grey', colorHex: '#4A4A4A' },
  { sku: 'SH006', categorySlug: 'shorts', folderKey: 'Shorts', name: SHORTS_NAME, color: 'Brown', colorHex: '#5A3E2B' },
  { sku: 'SH007', categorySlug: 'shorts', folderKey: 'Shorts', name: SHORTS_NAME, color: 'Light Grey', colorHex: '#B8B8B8' },
  { sku: 'SH008', categorySlug: 'shorts', folderKey: 'Shorts', name: SHORTS_NAME, color: 'Navy', colorHex: '#1B2A4A' },
  { sku: 'SH009', categorySlug: 'shorts', folderKey: 'Shorts', name: SHORTS_NAME, color: 'Beige', colorHex: '#D8C9AE' },
  { sku: 'SH010', categorySlug: 'shorts', folderKey: 'Shorts', name: SHORTS_NAME, color: 'Black Blue', colorHex: '#21283B' },

  // ───────────────────────────── FORMAL PANTS ────────────────────────────────────────────────
  { sku: 'FP001', categorySlug: 'formal-pants', folderKey: 'Formal Pants', name: FORMAL_PANTS_NAME, color: 'Blue 3', colorHex: '#3B5578' },
  { sku: 'FP002', categorySlug: 'formal-pants', folderKey: 'Formal Pants', name: FORMAL_PANTS_NAME, color: 'Light Grey', colorHex: '#B8B8B8' },
  { sku: 'FP003', categorySlug: 'formal-pants', folderKey: 'Formal Pants', name: FORMAL_PANTS_NAME, color: 'Noble Khaki', colorHex: '#8A7A54' },
  { sku: 'FP004', categorySlug: 'formal-pants', folderKey: 'Formal Pants', name: FORMAL_PANTS_NAME, color: 'Black', colorHex: '#1A1A1A' },
  { sku: 'FP005', categorySlug: 'formal-pants', folderKey: 'Formal Pants', name: FORMAL_PANTS_NAME, color: 'Grey', colorHex: '#8A8A8A' },
  { sku: 'FP006', categorySlug: 'formal-pants', folderKey: 'Formal Pants', name: FORMAL_PANTS_NAME, color: 'Slate Blue', colorHex: '#5B6E8C' },
  { sku: 'FP007', categorySlug: 'formal-pants', folderKey: 'Formal Pants', name: FORMAL_PANTS_NAME, color: 'Pista Green', colorHex: '#9CAF6B' },
  { sku: 'FP008', categorySlug: 'formal-pants', folderKey: 'Formal Pants', name: FORMAL_PANTS_NAME, color: 'Anchor Grey', colorHex: '#5D6068' },
  { sku: 'FP009', categorySlug: 'formal-pants', folderKey: 'Formal Pants', name: FORMAL_PANTS_NAME, color: 'Light Grey', colorHex: '#B8B8B8' },
  { sku: 'FP010', categorySlug: 'formal-pants', folderKey: 'Formal Pants', name: FORMAL_PANTS_NAME, color: 'Teal', colorHex: '#1F6F6B' },
  { sku: 'FP011', categorySlug: 'formal-pants', folderKey: 'Formal Pants', name: FORMAL_PANTS_NAME, color: 'Olive Green', colorHex: '#6B6E3A' },
  { sku: 'FP012', categorySlug: 'formal-pants', folderKey: 'Formal Pants', name: FORMAL_PANTS_NAME, color: 'Beige', colorHex: '#D8C9AE' },

  // ───────────────────────────── BLAZERS ─────────────────────────────────────────────────────
  { sku: 'BZ001', categorySlug: 'blazers', folderKey: 'Blazers', name: BLAZER_NAME, color: 'Black', colorHex: '#1A1A1A' },
  { sku: 'BZ002', categorySlug: 'blazers', folderKey: 'Blazers', name: BLAZER_NAME, color: 'Midnight Navy', colorHex: '#14213D' },
  { sku: 'BZ003', categorySlug: 'blazers', folderKey: 'Blazers', name: BLAZER_NAME, color: 'Dark Grey', colorHex: '#4A4A4A' },
  { sku: 'BZ004', categorySlug: 'blazers', folderKey: 'Blazers', name: BLAZER_NAME, color: 'Desert Khaki', colorHex: '#B79C6B' },
  { sku: 'BZ005', categorySlug: 'blazers', folderKey: 'Blazers', name: BLAZER_NAME, color: 'White', colorHex: '#F5F5F5' },
  { sku: 'BZ006', categorySlug: 'blazers', folderKey: 'Blazers', name: BLAZER_NAME, color: 'Black', colorHex: '#1A1A1A' },

  // ───────────────────────────── JACKETS ─────────────────────────────────────────────────────
  { sku: 'JK001', categorySlug: 'jackets', folderKey: 'jackets', name: JACKET_NAME, color: 'Light Grey', colorHex: '#B8B8B8' },
  { sku: 'JK002', categorySlug: 'jackets', folderKey: 'jackets', name: JACKET_NAME, color: 'Black', colorHex: '#1A1A1A' },
  { sku: 'JK003', categorySlug: 'jackets', folderKey: 'jackets', name: JACKET_NAME, color: 'Green', colorHex: '#4E7A4E' },
  { sku: 'JK004', categorySlug: 'jackets', folderKey: 'jackets', name: JACKET_NAME, color: 'Light Blue', colorHex: '#7FA8C9' },
  { sku: 'JK005', categorySlug: 'jackets', folderKey: 'jackets', name: JACKET_NAME, color: 'Black', colorHex: '#1A1A1A' },
  { sku: 'JK006', categorySlug: 'jackets', folderKey: 'jackets', name: JACKET_NAME, color: 'Black', colorHex: '#1A1A1A' },

  // ───────────────────────────── HOODIES ─────────────────────────────────────────────────────
  { sku: 'HD001', categorySlug: 'hoodies', folderKey: 'hoodies', name: HOODIE_NAME, color: 'Potent Purple', colorHex: '#6A3FA0' },
  { sku: 'HD002', categorySlug: 'hoodies', folderKey: 'hoodies', name: HOODIE_NAME, color: 'Ballad Blue', colorHex: '#4A6FA5' },
  { sku: 'HD003', categorySlug: 'hoodies', folderKey: 'hoodies', name: HOODIE_NAME, color: 'Black', colorHex: '#1A1A1A' },
  { sku: 'HD004', categorySlug: 'hoodies', folderKey: 'hoodies', name: HOODIE_NAME, color: 'Grey', colorHex: '#8A8A8A' },
  { sku: 'HD005', categorySlug: 'hoodies', folderKey: 'hoodies', name: HOODIE_NAME, color: 'Olive', colorHex: '#6B6E3A' },
  { sku: 'HD006', categorySlug: 'hoodies', folderKey: 'hoodies', name: HOODIE_NAME, color: 'Grey', colorHex: '#8A8A8A' },

  // ───────────────────────────── SWEATSHIRTS ─────────────────────────────────────────────────
  { sku: 'SW001', categorySlug: 'sweatshirts', folderKey: 'Sweatshirts', name: SWEATSHIRT_NAME, color: 'White', colorHex: '#F5F5F5' },
  { sku: 'SW002', categorySlug: 'sweatshirts', folderKey: 'Sweatshirts', name: SWEATSHIRT_NAME, color: 'Aqua Blue', colorHex: '#5CC9D6' },
  { sku: 'SW003', categorySlug: 'sweatshirts', folderKey: 'Sweatshirts', name: SWEATSHIRT_NAME, color: 'Coffee', colorHex: '#4A2E1F' },
  { sku: 'SW004', categorySlug: 'sweatshirts', folderKey: 'Sweatshirts', name: SWEATSHIRT_NAME, color: 'White', colorHex: '#F5F5F5' },
  { sku: 'SW005', categorySlug: 'sweatshirts', folderKey: 'Sweatshirts', name: SWEATSHIRT_NAME, color: 'Black / Dark Grey', colorHex: '#333333' },
  { sku: 'SW006', categorySlug: 'sweatshirts', folderKey: 'Sweatshirts', name: SWEATSHIRT_NAME, color: 'Black', colorHex: '#1A1A1A' },

  // ───────────────────────────── KURTA ────────────────────────────────────────────────────────
  { sku: 'KT001', categorySlug: 'kurtas', folderKey: 'Kurta', name: KURTA_NAME, color: 'Dusty Pink', colorHex: '#C98B8B' },
  { sku: 'KT002', categorySlug: 'kurtas', folderKey: 'Kurta', name: KURTA_NAME, color: 'Yellow', colorHex: '#E8C84A' },
  { sku: 'KT003', categorySlug: 'kurtas', folderKey: 'Kurta', name: KURTA_NAME, color: 'Beige', colorHex: '#D8C9AE' },
  { sku: 'KT004', categorySlug: 'kurtas', folderKey: 'Kurta', name: KURTA_NAME, color: 'White', colorHex: '#F5F5F5' },
  { sku: 'KT005', categorySlug: 'kurtas', folderKey: 'Kurta', name: KURTA_NAME, color: 'Navy Blue', colorHex: '#1B2A4A' },
  { sku: 'KT006', categorySlug: 'kurtas', folderKey: 'Kurta', name: KURTA_NAME, color: 'Grey', colorHex: '#8A8A8A' },
  { sku: 'KT007', categorySlug: 'kurtas', folderKey: 'Kurta', name: KURTA_NAME, color: 'Blue', colorHex: '#3B6EA5' },
  { sku: 'KT008', categorySlug: 'kurtas', folderKey: 'Kurta', name: KURTA_NAME, color: 'Maroon', colorHex: '#6B1F2B' },

  // ───────────────────────────── SHERWANI ─────────────────────────────────────────────────────
  { sku: 'SHW001', categorySlug: 'sherwanis', folderKey: 'Sherwani', name: SHERWANI_NAME, color: 'Yellow', colorHex: '#E8C84A' },
  { sku: 'SHW002', categorySlug: 'sherwanis', folderKey: 'Sherwani', name: SHERWANI_NAME, color: 'Saffron', colorHex: '#E58B2E' },
  { sku: 'SHW003', categorySlug: 'sherwanis', folderKey: 'Sherwani', name: SHERWANI_NAME, color: 'Multi Silver', colorHex: '#C7C7C7' },
  { sku: 'SHW004', categorySlug: 'sherwanis', folderKey: 'Sherwani', name: SHERWANI_NAME, color: 'Tan', colorHex: '#C9A876' },
  { sku: 'SHW005', categorySlug: 'sherwanis', folderKey: 'Sherwani', name: SHERWANI_NAME, color: 'Black', colorHex: '#1A1A1A' },
  { sku: 'SHW006', categorySlug: 'sherwanis', folderKey: 'Sherwani', name: SHERWANI_NAME, color: 'Red', colorHex: '#B3242A' },

  // ───────────────────────────── INNERWEAR ────────────────────────────────────────────────────
  { sku: 'IW001', categorySlug: 'innerwear', folderKey: 'Innerwear', name: INNERWEAR_NAME, color: 'Navy Blue', colorHex: '#1B2A4A', brandSlug: 'axe-hammer' },
  { sku: 'IW002', categorySlug: 'innerwear', folderKey: 'Innerwear', name: INNERWEAR_NAME, color: 'Beige', colorHex: '#B7A088', brandSlug: 'axe-hammer' },
  { sku: 'IW003', categorySlug: 'innerwear', folderKey: 'Innerwear', name: INNERWEAR_NAME, color: 'Steel Blue', colorHex: '#5E7A93', brandSlug: 'axe-hammer' },

  // ───────────────────────────── BELTS ────────────────────────────────────────────────────────
  { sku: 'BL001', categorySlug: 'belts', folderKey: 'Belts', name: BELT_NAME, color: 'Black', colorHex: '#1A1A1A' },
  { sku: 'BL002', categorySlug: 'belts', folderKey: 'Belts', name: BELT_NAME, color: 'Brown TM20', colorHex: '#5A3E2B' },
  { sku: 'BL003', categorySlug: 'belts', folderKey: 'Belts', name: BELT_NAME, color: 'Blix Black', colorHex: '#1A1A1A' },
  { sku: 'BL004', categorySlug: 'belts', folderKey: 'Belts', name: BELT_NAME, color: 'Wood Brown SCB30', colorHex: '#6F4E37' },

  // ───────────────────────────── VESTS ────────────────────────────────────────────────────────
  { sku: 'VS001', categorySlug: 'vests', folderKey: 'Vests', name: VEST_NAME, color: 'White', colorHex: '#F5F5F5' },
  { sku: 'VS002', categorySlug: 'vests', folderKey: 'Vests', name: VEST_NAME, color: 'White', colorHex: '#F5F5F5' },
  { sku: 'VS003', categorySlug: 'vests', folderKey: 'Vests', name: VEST_NAME, color: 'Blue', colorHex: '#3B6EA5' },
  { sku: 'VS004', categorySlug: 'vests', folderKey: 'Vests', name: VEST_NAME, color: 'Black', colorHex: '#1A1A1A' },
  { sku: 'VS005', categorySlug: 'vests', folderKey: 'Vests', name: VEST_NAME, color: 'Grey', colorHex: '#8A8A8A' },
];
