import type { Gender } from '@/types';

/**
 * Maps every catalog category slug to one of the folders under
 * public/images/products/<gender>/<folder>/ (see that directory for the full
 * scaffolded list). Categories that don't fit an apparel bucket (shoes,
 * belts/wallets/watches) get their own folder rather than being misfiled.
 */
const CATEGORY_FOLDER_MAP: Record<string, string> = {
  // Men — shirts
  'formal-shirts': 'formal-shirts',
  'casual-shirts': 'casual-shirts',
  // These 6 used to fall back to a shared folder (casual-shirts/tshirts) before each got its own
  // real, dedicated photography — see scripts/curatedShirtsTshirtsData.ts and productImageManifest.ts.
  'printed-shirts': 'Printed-Shirts',
  'checked-shirts': 'checked-shirts',
  'solid-shirts': 'Solid-Shirts',
  'linen-shirts': 'casual-shirts',
  'cotton-shirts': 'Cotton-Shirts',
  // These 11 used to fall back to a shared folder (casual-shirts/tshirts/jeans/jackets/hoodies/
  // accessories) before each got its own real, dedicated photography — see
  // scripts/curatedApparelData.ts and productImageManifest.ts.
  kurtas: 'Kurta',
  // Men — t-shirts
  'polo-tshirts': 'polo-tshirts',
  'round-neck-tshirts': 'Round Neck T-Shirts',
  'oversized-tshirts': 'Oversized T-Shirts',
  'henley-tshirts': 'Henley T-Shirts',
  innerwear: 'Innerwear',
  // Men — bottomwear
  'slim-jeans': 'Slim Jeans',
  'regular-jeans': 'Regular Jeans',
  'cargo-pants': 'Cargo Pants',
  joggers: 'Joggers',
  shorts: 'Shorts',
  'formal-pants': 'Formal Pants',
  // Men — outerwear
  blazers: 'Blazers',
  jackets: 'jackets',
  sherwanis: 'Sherwani',
  hoodies: 'hoodies',
  sweatshirts: 'Sweatshirts',
  // Men — accessories & footwear
  belts: 'Belts',
  vests: 'Vests',
  wallets: 'accessories',
  watches: 'accessories',
  sneakers: 'shoes',
  loafers: 'shoes',
  'sports-shoes': 'shoes',
  sandals: 'shoes',

  // Kids
  'kids-tshirts': 'tshirts',
  'kids-shirts': 'shirts',
  // These 3 used to fall back to a shared folder (shirts/jeans) before each got its own real,
  // dedicated photography — see scripts/curatedKidsData.ts and productImageManifest.ts.
  'school-uniform': 'School Uniform',
  'kids-party-wear': 'Party Wear',
  'kids-joggers': 'Joggers',
  'kids-jeans': 'jeans',
  'kids-shorts': 'shorts',
  'kids-hoodies': 'hoodies',
  'kids-sweaters': 'hoodies',
  'kids-jackets': 'jackets',
  'kids-winter-wear': 'jackets',
  'kids-shoes': 'shoes',
  'kids-sandals': 'shoes',
};

export function getImageFolder(categorySlug: string): string {
  return CATEGORY_FOLDER_MAP[categorySlug] ?? 'general';
}

/**
 * The public/images/products/<gender>/<folder>/ convention every product's photography follows —
 * this is also the exact <gender>/<folder>/ prefix used by scripts/seedFirestore.ts when assigning
 * on-disk photos to seeded products, so the same file can live in either place under an identical
 * path. This module is intentionally environment-agnostic (no Firebase client, no import.meta.env)
 * since it's imported by both the browser bundle and the Node.js seed script — see productService.ts
 * for where a live product's own image_url/thumbnail_url/gallery_images fields take over.
 */
export function getProductImageBasePath(gender: Gender, categorySlug: string): string {
  return `${gender}/${getImageFolder(categorySlug)}`;
}

/**
 * Resolves a product image filename to its path under public/images/products/. Nothing is
 * generated here: until a real file is uploaded to that path, the URL simply 404s and
 * <ProductImage>'s error fallback takes over.
 *
 * Folder/file segments are URL-encoded individually — some of the newer category folders (e.g.
 * "Round Neck T-Shirts") contain literal spaces, which must be encoded per-segment (not as one
 * encoded whole, which would also escape the `/` separators and produce a malformed path).
 */
export function resolveProductImagePath(gender: Gender, categorySlug: string, filename: string): string {
  const folder = getImageFolder(categorySlug);
  return `/images/products/${encodeURIComponent(gender)}/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`;
}

export interface ProductImageSet {
  imageUrl: string;
  thumbnailUrl: string;
  galleryImages: string[];
}

/** Generic fallback — shown for any product that has no real photography of its own and isn't one
 *  of the categories below (never another product's photo). */
export const PLACEHOLDER_IMAGE_PATH = '/images/placeholder-shirt.webp';

/** A handful of categories have zero on-disk photography at all (no source photos were ever
 *  provided for them — see the image audit report) and are visually nothing like a shirt, so the
 *  generic apparel placeholder above looks wrong for them specifically. These get their own
 *  category-shaped fallback instead — still an honest "no photo available" placeholder, never a
 *  fabricated product photo. */
const PLACEHOLDER_BY_CATEGORY_SLUG: Record<string, string> = {
  sneakers: '/images/placeholder-shoe.svg',
  loafers: '/images/placeholder-shoe.svg',
  'sports-shoes': '/images/placeholder-shoe.svg',
  sandals: '/images/placeholder-shoe.svg',
  'kids-shoes': '/images/placeholder-shoe.svg',
  'kids-sandals': '/images/placeholder-shoe.svg',
  wallets: '/images/placeholder-accessory.svg',
  watches: '/images/placeholder-accessory.svg',
};

/** The right "no photo available" placeholder for this category — a shoe/accessory-shaped one for
 *  the handful of categories with zero real photography (see PLACEHOLDER_BY_CATEGORY_SLUG above),
 *  the generic apparel one for everything else. */
export function placeholderImagePathFor(categorySlug: string): string {
  return PLACEHOLDER_BY_CATEGORY_SLUG[categorySlug] ?? PLACEHOLDER_IMAGE_PATH;
}

/** Every path a product's image fields are allowed to intentionally point at when it has no real
 *  photography — used by scripts/auditProductImages.ts to tell "this is a known, deliberate
 *  placeholder shared by every photo-less product in this category" apart from an actual bug. */
export const KNOWN_PLACEHOLDER_PATHS: readonly string[] = [PLACEHOLDER_IMAGE_PATH, ...new Set(Object.values(PLACEHOLDER_BY_CATEGORY_SLUG))];

const PLACEHOLDER_IMAGE_SET: ProductImageSet = {
  imageUrl: PLACEHOLDER_IMAGE_PATH,
  thumbnailUrl: PLACEHOLDER_IMAGE_PATH,
  galleryImages: [PLACEHOLDER_IMAGE_PATH],
};

export interface ColorPhotoSet {
  color: string;
  images: string[];
}

export interface RealProductPhotography extends ProductImageSet {
  perColor: ColorPhotoSet[];
  /** Authoritative colors for this product — replaces whatever colors the generator randomly picked, so the displayed color name always matches what's actually photographed. */
  colors: { name: string; hex: string }[];
}

interface PhotographyEntry {
  gender: Gender;
  categorySlug: string;
  /** One entry per color, in display order. The color's own photo set lives at the same index in photoSetsByColorIndex. */
  colors: { name: string; hex: string }[];
  photoSetsByColorIndex: string[][];
}

/**
 * Real photography, verified image-by-image and bound to specific products by their unique slug
 * (never by name — two generated products can share a display name, but slugs are always unique).
 * Every file below was visually confirmed to show the stated garment/color, and every entry here
 * was grouped by matching model + background + pose across images — never assumed from filename
 * or product name alone. Files with a marketplace watermark, a third-party brand logo, or that
 * weren't a garment photo at all were excluded entirely and are not referenced anywhere.
 *
 * `colors` is authoritative here (see RealProductPhotography.colors) — the bound product's
 * generated colors are overridden to match, so what the customer sees always agrees with what's
 * photographed. Products not listed here show only the shared placeholder.
 */
export const REAL_PRODUCT_PHOTOGRAPHY: Record<string, PhotographyEntry> = {
  // Sage green + teal — same tattooed, man-bun model, same stone balcony background, same pose
  // across both codes: one product, two colors.
  'ashworth-studio-signature-skinny-fit-formal-shirt-formal-shirts-150': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [
      { name: 'Sage Green', hex: '#8FA888' },
      { name: 'Teal', hex: '#1F6F6B' },
    ],
    photoSetsByColorIndex: [
      ['FS001-1.webp', 'FS001-2.webp', 'FS001-3.webp', 'FS001-4.webp'],
      ['FS002-1.webp', 'FS002-2.webp', 'FS002-3.webp', 'FS002-4.webp'],
    ],
  },
  'urban-threadworks-everyday-tailored-fit-formal-shirt-formal-shirts-2': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'White', hex: '#FFFFFF' }],
    photoSetsByColorIndex: [['FS003-1.webp', 'FS003-2.webp', 'FS003-3.webp', 'FS003-4.webp', 'FS003-5.webp', 'FS003-6.webp']],
  },
  'bellcrest-urban-regular-fit-formal-shirt-formal-shirts-3': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Purple', hex: '#6A3B6E' }],
    photoSetsByColorIndex: [['FS004-1.jpeg', 'FS004-2.jpeg', 'FS004-3.jpeg', 'FS004-4.jpeg']],
  },
  'rugged-anchor-modern-tailored-fit-formal-shirt-formal-shirts-4': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Teal', hex: '#1F6F6B' }],
    photoSetsByColorIndex: [['FS007-1.jpg', 'FS007-2.jpg', 'FS007-3.jpg', 'FS007-4.jpg', 'FS007-5.jpg']],
  },
  'kingsley-sons-comfort-fit-oversized-fit-formal-shirt-formal-shirts-5': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Mint Green', hex: '#A8D5BA' }],
    photoSetsByColorIndex: [['FS008-1.jpg', 'FS008-2.jpg', 'FS008-3.jpg', 'FS008-4.jpg']],
  },
  'milano-vault-everyday-slim-fit-formal-shirt-formal-shirts-6': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Black', hex: '#1C1C1C' }],
    photoSetsByColorIndex: [['FS009-1.jpg', 'FS009-2.jpg', 'FS009-3.jpg', 'FS009-4.jpg', 'FS009-5.jpg']],
  },
  'voltage-athletics-comfort-fit-slim-fit-formal-shirt-formal-shirts-7': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Black', hex: '#1C1C1C' }],
    photoSetsByColorIndex: [['FS010-1.jpg', 'FS010-2.jpg', 'FS010-3.jpg', 'FS010-4.jpg', 'FS010-5.jpg']],
  },
  'basecamp-supply-co-everyday-oversized-fit-formal-shirt-formal-shirts-8': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'White', hex: '#FFFFFF' }],
    photoSetsByColorIndex: [['FS011-1.jpg', 'FS011-2.jpg', 'FS011-3.jpg', 'FS011-4.jpg', 'FS011-5.jpg', 'FS011-6.jpg']],
  },
  'loom-fold-urban-oversized-fit-formal-shirt-formal-shirts-9': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Maroon', hex: '#6B1F2B' }],
    photoSetsByColorIndex: [['FS014-1.jpg', 'FS014-2.jpg', 'FS014-3.jpg', 'FS014-4.jpg', 'FS014-5.jpg']],
  },
  'ashworth-studio-classic-oversized-fit-formal-shirt-formal-shirts-10': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Grey', hex: '#A6A9AC' }],
    photoSetsByColorIndex: [['FS015-1.jpg', 'FS015-2.jpg', 'FS015-3.jpg', 'FS015-4.jpg']],
  },
  'prairie-denim-co-heritage-relaxed-fit-formal-shirt-formal-shirts-11': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Olive Green', hex: '#6B6E3A' }],
    photoSetsByColorIndex: [['FS016-1.jpg', 'FS016-2.jpg', 'FS016-3.jpg', 'FS016-4.jpg', 'FS016-5.png', 'FS016-6.png']],
  },
  'crownridge-essential-regular-fit-formal-shirt-formal-shirts-12': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Sky Blue', hex: '#8FC1E3' }],
    photoSetsByColorIndex: [['FS017-2.jpg', 'FS017-3.jpg', 'FS017-4.jpg', 'FS017-5.jpg']],
  },
  'fieldstone-footwear-modern-slim-fit-formal-shirt-formal-shirts-13': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Sky Blue', hex: '#8FC1E3' }],
    photoSetsByColorIndex: [['FS019-1.jpg', 'FS019-2.jpg', 'FS019-3.jpg']],
  },
  'meridian-time-co-modern-regular-fit-formal-shirt-formal-shirts-14': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Sky Blue', hex: '#8FC1E3' }],
    photoSetsByColorIndex: [['FS020-1.jpg', 'FS020-2.jpg', 'FS020-3.jpg', 'FS020-4.jpg']],
  },
  'northfield-co-classic-slim-fit-formal-shirt-formal-shirts-29': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Purple', hex: '#6A3B6E' }],
    photoSetsByColorIndex: [['FS021-1.webp', 'FS021-2.webp', 'FS021-3.webp']],
  },
  'bellcrest-classic-oversized-fit-formal-shirt-formal-shirts-17': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Lavender', hex: '#B6A0C9' }],
    photoSetsByColorIndex: [['FS023-1.png', 'FS023-2.png', 'FS023-3.png', 'FS023-4.png', 'FS023-5.png', 'FS023-6.png']],
  },
  'rugged-anchor-essential-tailored-fit-formal-shirt-formal-shirts-18': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Brown', hex: '#5A3E2B' }],
    photoSetsByColorIndex: [['FS024-1.png', 'FS024-2.png', 'FS024-3.png', 'FS024-4.png', 'FS024-5.png']],
  },
  'kingsley-sons-signature-tailored-fit-formal-shirt-formal-shirts-19': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Navy Blue', hex: '#1B2A4A' }],
    photoSetsByColorIndex: [['FS025-1.png', 'FS025-2.png', 'FS025-3.png', 'FS025-4.png']],
  },
  'milano-vault-heritage-oversized-fit-formal-shirt-formal-shirts-20': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Off-White', hex: '#E8E6DE' }],
    photoSetsByColorIndex: [['FS026-1.png', 'FS026-2.png', 'FS026-3.png']],
  },
  'voltage-athletics-classic-regular-fit-formal-shirt-formal-shirts-21': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Sky Blue', hex: '#8FC1E3' }],
    photoSetsByColorIndex: [['FS027-1.png', 'FS027-2.png', 'FS027-3.png', 'FS027-4.png', 'FS027-5.png', 'FS027-6.png']],
  },
  'basecamp-supply-co-comfort-fit-relaxed-fit-formal-shirt-formal-shirts-22': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Mustard', hex: '#B8860B' }],
    photoSetsByColorIndex: [['FS028-1.png', 'FS028-2.png', 'FS028-3.png', 'FS028-4.png', 'FS028-5.png']],
  },
  'loom-fold-everyday-tailored-fit-formal-shirt-formal-shirts-23': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Rust Orange', hex: '#B7410E' }],
    photoSetsByColorIndex: [['FS029-1.png', 'FS029-2.png', 'FS029-3.png', 'FS029-4.png', 'FS029-5.png', 'FS029-6.png']],
  },
  'ashworth-studio-premium-oversized-fit-formal-shirt-formal-shirts-24': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Teal', hex: '#1F6F6B' }],
    photoSetsByColorIndex: [['FS030-1.png', 'FS030-2.png', 'FS030-3.png', 'FS030-4.png', 'FS030-5.png']],
  },

  // --- Second batch (FS031-FS073) — verified image-by-image the same way as above. This batch's
  // photography is uniformly clean (no watermarks or third-party brand tags found in any image),
  // so no exclusions were needed here beyond one corrupted partial download (FS045-2, deleted) and
  // four exact-duplicate frames within a single code (deleted, keeping one copy each).
  'northfield-co-premium-oversized-fit-formal-shirt-formal-shirts-1': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Sky Blue', hex: '#8FC1E3' }],
    photoSetsByColorIndex: [['FS031-1.jpg', 'FS031-2.jpg', 'FS031-3.jpg', 'FS031-4.jpg', 'FS031-5.jpg', 'FS031-6.jpg']],
  },
  'northfield-co-modern-regular-fit-formal-shirt-formal-shirts-15': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Baby Blue', hex: '#B8DCF0' }],
    photoSetsByColorIndex: [['FS032-1.jpg', 'FS032-2.jpg', 'FS032-3.jpg', 'FS032-4.jpg', 'FS032-5.jpg']],
  },
  'urban-threadworks-comfort-fit-regular-fit-formal-shirt-formal-shirts-16': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Khaki', hex: '#C3A868' }],
    photoSetsByColorIndex: [['FS033-1.jpg', 'FS033-2.jpg', 'FS033-3.jpg', 'FS033-4.jpg', 'FS033-5.jpg', 'FS033-6.jpg']],
  },
  'prairie-denim-co-modern-tailored-fit-formal-shirt-formal-shirts-25': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Red', hex: '#C0202B' }],
    photoSetsByColorIndex: [['FS034-1.jpg', 'FS034-2.jpg', 'FS034-3.jpg', 'FS034-4.jpg', 'FS034-5.jpg', 'FS034-6.jpg']],
  },
  'crownridge-signature-regular-fit-formal-shirt-formal-shirts-26': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'White', hex: '#FFFFFF' }],
    photoSetsByColorIndex: [['FS035-1.jpg', 'FS035-2.jpg', 'FS035-3.jpg', 'FS035-4.jpg', 'FS035-5.jpg', 'FS035-6.jpg']],
  },
  'fieldstone-footwear-active-slim-fit-formal-shirt-formal-shirts-27': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Wine', hex: '#6E1F2A' }],
    photoSetsByColorIndex: [['FS036-1.jpg', 'FS036-2.jpg', 'FS036-3.jpg', 'FS036-4.jpg', 'FS036-5.jpg', 'FS036-6.jpg', 'FS036-7.jpg']],
  },
  'meridian-time-co-urban-oversized-fit-formal-shirt-formal-shirts-28': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Black', hex: '#1C1C1C' }],
    photoSetsByColorIndex: [['FS037-1.jpg', 'FS037-2.jpg', 'FS037-3.jpg', 'FS037-4.jpg', 'FS037-5.jpg', 'FS037-6.jpg', 'FS037-7.jpg']],
  },
  'urban-threadworks-comfort-fit-regular-fit-formal-shirt-formal-shirts-30': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Pink', hex: '#F0A8B8' }],
    photoSetsByColorIndex: [['FS038-1.jpg', 'FS038-2.jpg', 'FS038-3.jpg', 'FS038-4.jpg', 'FS038-5.jpg', 'FS038-6.jpg']],
  },
  'bellcrest-modern-relaxed-fit-formal-shirt-formal-shirts-31': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Magenta', hex: '#7A2048' }],
    photoSetsByColorIndex: [['FS039-1.jpg', 'FS039-2.jpg', 'FS039-3.jpg', 'FS039-4.jpg', 'FS039-5.jpg', 'FS039-6.jpg', 'FS039-7.jpg']],
  },
  'rugged-anchor-heritage-relaxed-fit-formal-shirt-formal-shirts-32': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Olive Green', hex: '#6B6E3A' }],
    photoSetsByColorIndex: [['FS040-1.jpg', 'FS040-2.jpg', 'FS040-3.jpg', 'FS040-4.jpg', 'FS040-5.jpg', 'FS040-6.jpg', 'FS040-7.jpg']],
  },
  'kingsley-sons-comfort-fit-oversized-fit-formal-shirt-formal-shirts-33': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Orange', hex: '#D9631E' }],
    photoSetsByColorIndex: [['FS041-1.jpg', 'FS041-2.jpg', 'FS041-3.jpg', 'FS041-4.jpg', 'FS041-5.jpg', 'FS041-6.jpg', 'FS041-7.jpg']],
  },
  'milano-vault-premium-oversized-fit-formal-shirt-formal-shirts-34': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Sea Green', hex: '#4E8B7C' }],
    photoSetsByColorIndex: [['FS042-1.jpg', 'FS042-2.jpg', 'FS042-3.jpg', 'FS042-4.jpg', 'FS042-5.jpg', 'FS042-6.jpg', 'FS042-7.jpg']],
  },
  'voltage-athletics-classic-relaxed-fit-formal-shirt-formal-shirts-35': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Navy Blue 2', hex: '#33495F' }],
    photoSetsByColorIndex: [['FS043-1.jpg', 'FS043-2.jpg', 'FS043-3.jpg', 'FS043-4.jpg', 'FS043-5.jpg', 'FS043-6.jpg']],
  },
  'basecamp-supply-co-classic-regular-fit-formal-shirt-formal-shirts-36': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Grey', hex: '#A6A9AC' }],
    photoSetsByColorIndex: [['FS044-1.jpg', 'FS044-2.jpg', 'FS044-3.jpg', 'FS044-4.jpg']],
  },
  'loom-fold-modern-tailored-fit-formal-shirt-formal-shirts-37': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Slate Grey', hex: '#8B8F94' }],
    // FS045-2 was an incomplete/corrupted partial download (.crdownload) — excluded, not a valid image.
    photoSetsByColorIndex: [['FS045-1.jpg', 'FS045-3.jpg', 'FS045-4.jpg', 'FS045-5.jpg']],
  },
  'ashworth-studio-heritage-relaxed-fit-formal-shirt-formal-shirts-38': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Light Blue', hex: '#A9CDE8' }],
    photoSetsByColorIndex: [['FS046-1.jpg', 'FS046-2.jpg', 'FS046-3.jpg', 'FS046-4.jpg', 'FS046-5.jpg']],
  },
  'prairie-denim-co-heritage-slim-fit-formal-shirt-formal-shirts-39': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Maroon', hex: '#7A2E32' }],
    photoSetsByColorIndex: [['FS047-1.jpg', 'FS047-2.jpg', 'FS047-3.jpg', 'FS047-4.jpg']],
  },
  'crownridge-comfort-fit-relaxed-fit-formal-shirt-formal-shirts-40': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Dark Maroon', hex: '#4A1620' }],
    photoSetsByColorIndex: [['FS048-1.jpg', 'FS048-2.jpg', 'FS048-3.jpg', 'FS048-4.jpg']],
  },
  'fieldstone-footwear-heritage-relaxed-fit-formal-shirt-formal-shirts-41': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Purple', hex: '#6A3B6E' }],
    photoSetsByColorIndex: [['FS049-1.jpg', 'FS049-2.jpg', 'FS049-3.jpg', 'FS049-4.jpg', 'FS049-5.jpg', 'FS049-6.jpg']],
  },
  'meridian-time-co-everyday-tailored-fit-formal-shirt-formal-shirts-42': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Royal Blue', hex: '#2647A6' }],
    // FS050-4 was an exact duplicate of FS050-3 — excluded to avoid a duplicate gallery image.
    photoSetsByColorIndex: [['FS050-1.jpg', 'FS050-2.jpg', 'FS050-3.jpg', 'FS050-5.jpg']],
  },
  'northfield-co-comfort-fit-oversized-fit-formal-shirt-formal-shirts-43': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Turquoise', hex: '#2FA6A0' }],
    photoSetsByColorIndex: [['FS051-1.jpg', 'FS051-2.jpg', 'FS051-3.jpg', 'FS051-4.jpg', 'FS051-5.jpg']],
  },
  'urban-threadworks-active-tailored-fit-formal-shirt-formal-shirts-44': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Magenta', hex: '#B0286B' }],
    photoSetsByColorIndex: [['FS052-1.jpg', 'FS052-2.jpg', 'FS052-3.jpg', 'FS052-4.jpg']],
  },
  'bellcrest-active-skinny-fit-formal-shirt-formal-shirts-45': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Light Blue', hex: '#A9CDE8' }],
    // FS053-3 was an exact duplicate of FS053-1 — excluded; reordered so the front-facing shot (-2) leads.
    photoSetsByColorIndex: [['FS053-2.jpg', 'FS053-1.jpg', 'FS053-4.jpg', 'FS053-5.jpg', 'FS053-6.jpg']],
  },
  'rugged-anchor-everyday-skinny-fit-formal-shirt-formal-shirts-46': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Aqua', hex: '#7FC7C2' }],
    photoSetsByColorIndex: [['FS054-1.jpg', 'FS054-2.jpg', 'FS054-3.jpg', 'FS054-4.jpg']],
  },
  'kingsley-sons-active-tailored-fit-formal-shirt-formal-shirts-47': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Sea Green', hex: '#4E8B7C' }],
    photoSetsByColorIndex: [['FS055-1.jpg', 'FS055-2.jpg', 'FS055-3.jpg', 'FS055-4.jpg', 'FS055-5.jpg', 'FS055-6.jpg']],
  },
  'milano-vault-signature-skinny-fit-formal-shirt-formal-shirts-48': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Pale Yellow', hex: '#EDE1A6' }],
    photoSetsByColorIndex: [['FS056-1.jpg', 'FS056-2.jpg', 'FS056-3.jpg', 'FS056-4.jpg', 'FS056-5.jpg', 'FS056-6.jpg']],
  },
  'voltage-athletics-signature-relaxed-fit-formal-shirt-formal-shirts-49': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Bottle Green', hex: '#1F4A34' }],
    photoSetsByColorIndex: [['FS057-1.jpg', 'FS057-2.jpg', 'FS057-3.jpg', 'FS057-4.jpg', 'FS057-5.jpg', 'FS057-6.jpg', 'FS057-7.jpg']],
  },
  'basecamp-supply-co-essential-oversized-fit-formal-shirt-formal-shirts-50': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Brown', hex: '#5A3E2B' }],
    // FS058-2 was an exact duplicate of FS058-1 — excluded; reordered so the front-facing shot (-3) leads.
    photoSetsByColorIndex: [['FS058-3.jpg', 'FS058-1.jpg', 'FS058-4.jpg']],
  },
  'loom-fold-modern-skinny-fit-formal-shirt-formal-shirts-51': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Dark Grey', hex: '#3A3A3D' }],
    // FS059-7 was an exact duplicate of FS059-6 — excluded to avoid a duplicate gallery image.
    photoSetsByColorIndex: [['FS059-1.jpg', 'FS059-2.jpg', 'FS059-3.jpg', 'FS059-4.jpg', 'FS059-5.jpg', 'FS059-6.jpg', 'FS059-8.jpg']],
  },
  'ashworth-studio-active-regular-fit-formal-shirt-formal-shirts-52': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Lavender', hex: '#B6A0C9' }],
    photoSetsByColorIndex: [['FS060-1.jpg', 'FS060-2.jpg', 'FS060-3.jpg', 'FS060-4.jpg']],
  },
  'prairie-denim-co-active-slim-fit-formal-shirt-formal-shirts-53': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Red (Variant)', hex: '#C4525C' }],
    photoSetsByColorIndex: [['FS061-1.jpg', 'FS061-2.jpg', 'FS061-3.jpg']],
  },
  'crownridge-urban-skinny-fit-formal-shirt-formal-shirts-54': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Light Blue / Lilac', hex: '#AEC2E0' }],
    photoSetsByColorIndex: [['FS062-1.jpg', 'FS062-2.jpg', 'FS062-3.jpg']],
  },
  'fieldstone-footwear-classic-skinny-fit-formal-shirt-formal-shirts-55': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Beige', hex: '#D8C9AE' }],
    photoSetsByColorIndex: [['FS063-1.jpg', 'FS063-2.jpg', 'FS063-3.jpg', 'FS063-4.jpg', 'FS063-5.jpg']],
  },
  'meridian-time-co-comfort-fit-relaxed-fit-formal-shirt-formal-shirts-56': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Light White', hex: '#F5F2EA' }],
    photoSetsByColorIndex: [['FS064-1.jpg', 'FS064-2.jpg', 'FS064-3.jpg', 'FS064-4.jpg']],
  },
  'northfield-co-urban-skinny-fit-formal-shirt-formal-shirts-57': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Peach', hex: '#F3B98E' }],
    photoSetsByColorIndex: [['FS065-1.jpg', 'FS065-2.jpg', 'FS065-3.jpg', 'FS065-4.jpg', 'FS065-5.jpg']],
  },
  'urban-threadworks-heritage-skinny-fit-formal-shirt-formal-shirts-58': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Navy Blue', hex: '#1B2A4A' }],
    photoSetsByColorIndex: [['FS066-1.jpg', 'FS066-2.jpg', 'FS066-3.jpg', 'FS066-4.jpg', 'FS066-5.jpg', 'FS066-6.jpg']],
  },
  'bellcrest-essential-regular-fit-formal-shirt-formal-shirts-59': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Mist', hex: '#DCE8E6' }],
    photoSetsByColorIndex: [['FS067-1.jpg', 'FS067-2.jpg', 'FS067-3.jpg', 'FS067-4.jpg', 'FS067-5.jpg']],
  },
  'rugged-anchor-active-relaxed-fit-formal-shirt-formal-shirts-60': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Blue', hex: '#3F72AF' }],
    photoSetsByColorIndex: [['FS068-1.jpg', 'FS068-2.jpg', 'FS068-3.jpg', 'FS068-4.jpg']],
  },
  'kingsley-sons-essential-tailored-fit-formal-shirt-formal-shirts-61': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Red 1', hex: '#B23A44' }],
    photoSetsByColorIndex: [['FS069-1.jpg', 'FS069-2.jpg', 'FS069-3.jpg', 'FS069-4.jpg', 'FS069-5.jpg']],
  },
  'milano-vault-signature-relaxed-fit-formal-shirt-formal-shirts-62': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Sea Green', hex: '#4E8B7C' }],
    photoSetsByColorIndex: [['FS070-1.jpg', 'FS070-2.jpg', 'FS070-3.jpg', 'FS070-4.jpg', 'FS070-5.jpg', 'FS070-6.jpg', 'FS070-7.jpg']],
  },
  'voltage-athletics-classic-relaxed-fit-formal-shirt-formal-shirts-63': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Light Peach', hex: '#F6D2B8' }],
    photoSetsByColorIndex: [['FS071-1.jpg', 'FS071-2.jpg', 'FS071-3.jpg', 'FS071-4.jpg', 'FS071-5.jpg']],
  },
  'basecamp-supply-co-premium-regular-fit-formal-shirt-formal-shirts-64': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Lilac', hex: '#C6A9D9' }],
    photoSetsByColorIndex: [['FS072-1.jpg', 'FS072-2.jpg', 'FS072-3.jpg', 'FS072-4.jpg', 'FS072-5.jpg']],
  },
  'loom-fold-comfort-fit-relaxed-fit-formal-shirt-formal-shirts-65': {
    gender: 'men',
    categorySlug: 'formal-shirts',
    colors: [{ name: 'Wine', hex: '#6E1F2A' }],
    photoSetsByColorIndex: [['FS073-1.jpg', 'FS073-2.jpg', 'FS073-3.jpg', 'FS073-4.jpg', 'FS073-5.jpg', 'FS073-6.jpg']],
  },
};

/**
 * Looks up real, uploaded photography for one exact product by its unique slug, split per color
 * variant, with the authoritative color list to override the generator's random pick. Returns null
 * for every other product — the overwhelming majority — which must show the shared placeholder
 * instead of borrowing another product's images.
 */
export function getRealProductPhotography(productSlug: string): RealProductPhotography | null {
  const entry = REAL_PRODUCT_PHOTOGRAPHY[productSlug];
  if (!entry) return null;

  const perColor: ColorPhotoSet[] = entry.colors.map((color, i) => {
    const files = entry.photoSetsByColorIndex[i] ?? [];
    return { color: color.name, images: files.map((filename) => resolveProductImagePath(entry.gender, entry.categorySlug, filename)) };
  });

  const galleryImages = perColor.flatMap((set) => set.images);
  return { imageUrl: galleryImages[0], thumbnailUrl: galleryImages[0], galleryImages, perColor, colors: entry.colors };
}

/**
 * Builds the thumbnail/main/gallery image paths for one product. Every product without real,
 * explicitly-uploaded photography of its own (see getRealProductPhotography) shows only the shared
 * placeholder — never another product's photos.
 */
export function buildProductImageSet(productSlug: string): ProductImageSet {
  return getRealProductPhotography(productSlug) ?? PLACEHOLDER_IMAGE_SET;
}

export interface VerifiedColor {
  name: string;
  hex: string;
}

/**
 * NOTE: real Checked Shirt photography (CHS001-CHS030, minus CHS015) now exists on disk under
 * public/images/products/men/checked-shirts/ (uploaded directly, not via this codebase) — this
 * superseded an earlier batch of procedurally-generated SVG placeholder art (see the now-unused
 * scripts/generateCheckedShirtPlaceholders.mjs) that used to have entries here. Those invented
 * colors no longer describe what's actually in the (real) photos, so they've been removed rather
 * than left in place silently claiming ground truth they no longer have — that mismatch is exactly
 * the "Purple shirt labeled Khaki" class of bug this whole verified-color mechanism exists to
 * prevent. Until someone hand-verifies each CHS code's real photo the same way the FS031-073 batch
 * was verified (see REAL_PRODUCT_PHOTOGRAPHY above), generic Checked Shirts products fall back to a
 * random color pick from COLOR_PALETTE — the same, already-accepted behavior every other
 * non-curated category (jeans, jackets, hoodies, etc.) already has.
 */

/**
 * Code -> hand-verified color, independent of which (mock-catalog-era) product slug a photo set was
 * originally bound to — e.g. "FS004" -> Purple. This is what lets a freshly-generated product (with
 * a brand-new random slug/id) that happens to reuse code FS004's photos still get assigned the
 * CORRECT color instead of an arbitrary random one. Built once from REAL_PRODUCT_PHOTOGRAPHY.
 */
const CODE_TO_VERIFIED_COLOR: Map<string, VerifiedColor> = (() => {
  const map = new Map<string, VerifiedColor>();
  for (const entry of Object.values(REAL_PRODUCT_PHOTOGRAPHY)) {
    entry.colors.forEach((color, i) => {
      (entry.photoSetsByColorIndex[i] ?? []).forEach((filename) => {
        const code = filename.split('-')[0];
        map.set(code, color);
      });
    });
  }
  return map;
})();

/** Hand-verified color for a real photo's product code (e.g. "FS004" -> Purple), if any is known. */
export function getVerifiedColorForCode(code: string): VerifiedColor | null {
  return CODE_TO_VERIFIED_COLOR.get(code) ?? null;
}

/** Same lookup, from a full image URL/filename (extracts the leading code, e.g. ".../FS004-1.jpeg" -> "FS004"). */
export function getVerifiedColorForImageUrl(url: string): VerifiedColor | null {
  const match = url.match(/([A-Za-z]+\d+)-\d+\.\w+$/);
  return match ? getVerifiedColorForCode(match[1]) : null;
}
