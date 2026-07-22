import type { Brand, Category, Product, ProductImage, ProductVariant } from '@/types';
import {
  ADJECTIVES,
  BRAND_DEFS,
  COLOR_PALETTE,
  FITS,
  KIDS_CATEGORY_DEFS,
  MATERIALS,
  MEN_CATEGORY_DEFS,
  OCCASIONS,
  PATTERNS,
  SIZE_SETS,
  type CategoryDef,
} from '@/data/catalogSource';
import { SeededRng } from './seededRandom';
import { slugify, calculateDiscount, estimateDeliveryDate } from './utils';
import { getRealProductPhotography, PLACEHOLDER_IMAGE_PATH } from './productImages';

const CATALOG_SEED = 190420;

// Public-domain sample clip (MDN's cc0-videos set), used only as demo footage for the
// mock catalog's product-video feature — no licensed product photography/video exists here.
const PRODUCT_VIDEO_URL = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

const PRICE_BANDS: Record<string, { min: number; max: number }> = {
  shirt: { min: 799, max: 2999 },
  tshirt: { min: 399, max: 1799 },
  jeans: { min: 999, max: 3499 },
  pants: { min: 799, max: 2799 },
  jacket: { min: 1499, max: 6999 },
  hoodie: { min: 999, max: 2999 },
  shoe: { min: 1299, max: 5999 },
  watch: { min: 1499, max: 8999 },
  default: { min: 399, max: 1999 },
};

const KIDS_PRICE_MULTIPLIER = 0.55;

function washCareFor(material: string): string {
  if (material.includes('Wool')) return 'Dry clean only. Do not bleach. Iron on low heat.';
  if (material.includes('Denim')) return 'Machine wash cold, inside out. Do not tumble dry. Iron on reverse.';
  if (material.includes('Linen')) return 'Hand wash or gentle machine cycle. Line dry in shade. Iron while damp.';
  return 'Machine wash cold with like colors. Do not bleach. Tumble dry low.';
}

function buildBrands(): Brand[] {
  return BRAND_DEFS.map((b, idx) => ({
    id: `brand-${idx + 1}`,
    name: b.name,
    slug: b.slug,
    logo_url: null,
    description: b.description,
    is_featured: b.isFeatured,
  }));
}

function buildCategories(): Category[] {
  const categories: Category[] = [
    { id: 'cat-men', name: 'Men', slug: 'men', gender: 'men', parent_id: null, image_url: null, sort_order: 0 },
    { id: 'cat-kids', name: 'Kids', slug: 'kids', gender: 'kids', parent_id: null, image_url: null, sort_order: 1 },
  ];

  [...MEN_CATEGORY_DEFS, ...KIDS_CATEGORY_DEFS].forEach((def, idx) => {
    categories.push({
      id: `cat-${def.slug}`,
      name: def.name,
      slug: def.slug,
      gender: def.gender,
      parent_id: def.gender === 'men' ? 'cat-men' : 'cat-kids',
      image_url: null,
      sort_order: idx + 2,
    });
  });

  return categories;
}

function eligibleBrandsFor(gender: 'men' | 'kids', brands: Brand[]): Brand[] {
  const focusMap = new Map(BRAND_DEFS.map((b) => [b.slug, b.focus]));
  return brands.filter((b) => {
    const focus = focusMap.get(b.slug);
    return focus === 'both' || (gender === 'men' && focus === 'men') || (gender === 'kids' && focus === 'kids');
  });
}

function buildVariants(
  rng: SeededRng,
  productId: string,
  def: CategoryDef,
  brandCode: string,
  priceOverrideChance: boolean,
  forcedColors?: { name: string; hex: string }[],
): {
  variants: ProductVariant[];
  colors: { name: string; hex: string }[];
} {
  const colorCount = def.sizeSet === 'onesize' || def.sizeSet === 'belt' ? rng.int(2, 3) : rng.int(2, 4);
  const randomColors = rng.pickMany(COLOR_PALETTE, colorCount);
  const sizes = SIZE_SETS[def.sizeSet];
  const variants: ProductVariant[] = [];

  // For products with real photography (forcedColors provided), the actual photographed colors
  // replace the randomly-picked ones — but every rng call below still runs exactly as many times
  // as it would for a normal product of this category, so overriding a color here never shifts
  // the seeded RNG sequence for any other, unrelated product generated afterward.
  const effectiveColors = forcedColors ?? randomColors;

  randomColors.forEach((_, colorIdx) => {
    sizes.forEach((size, sizeIdx) => {
      const stock = rng.int(0, 60);
      const priceOverride = priceOverrideChance && rng.bool(0.05) ? rng.int(1, 5) * 100 : null;
      if (colorIdx >= effectiveColors.length) return;
      const color = effectiveColors[colorIdx];
      variants.push({
        id: `${productId}-v-${colorIdx}-${sizeIdx}`,
        product_id: productId,
        size,
        color: color.name,
        color_hex: color.hex,
        sku: `${brandCode}-${slugify(def.slug).toUpperCase().slice(0, 6)}-${color.name.slice(0, 2).toUpperCase()}-${size.replace(/\s/g, '')}`,
        stock,
        price_override: priceOverride,
      });
    });
  });

  return { variants, colors: effectiveColors };
}

/**
 * Builds one product's image set and mirrors it into the legacy ProductImage[] shape the existing
 * gallery/360/lightbox UI already consumes. Only products with real, explicitly-uploaded
 * photography (see productImages.ts, keyed by slug) get their own photos — split per color variant
 * so switching color swatches shows that color's own photos. Every other product shows only the
 * shared placeholder; nothing here is ever borrowed from another product.
 */
function buildProductImages(
  productId: string,
  productName: string,
  real: ReturnType<typeof getRealProductPhotography>,
): { imageSet: { imageUrl: string; thumbnailUrl: string; galleryImages: string[] }; images: ProductImage[] } {
  if (real) {
    const images: ProductImage[] = real.perColor.flatMap((set, colorIdx) =>
      set.images.map((url, idx) => ({
        id: `${productId}-img-${colorIdx}-${idx}`,
        product_id: productId,
        url,
        alt: `${productName} — ${set.color} — photo ${idx + 1}`,
        color: set.color,
        sort_order: colorIdx * 100 + idx,
      })),
    );
    return { imageSet: { imageUrl: real.imageUrl, thumbnailUrl: real.thumbnailUrl, galleryImages: real.galleryImages }, images };
  }

  return {
    imageSet: { imageUrl: PLACEHOLDER_IMAGE_PATH, thumbnailUrl: PLACEHOLDER_IMAGE_PATH, galleryImages: [PLACEHOLDER_IMAGE_PATH] },
    images: [
      {
        id: `${productId}-img-0`,
        product_id: productId,
        url: PLACEHOLDER_IMAGE_PATH,
        alt: `${productName} — photo 1`,
        color: null,
        sort_order: 0,
      },
    ],
  };
}

function buildProductsForCategory(rng: SeededRng, def: CategoryDef, category: Category, brands: Brand[]): Product[] {
  const eligibleBrands = eligibleBrandsFor(def.gender, brands);
  const priceBand = PRICE_BANDS[def.garmentType] ?? PRICE_BANDS.default;
  const products: Product[] = [];

  // Pre-shuffle combinations of adjective/fit/pattern so names stay varied and non-repetitive.
  const combos: { adjective: string; fit: string; pattern: string; occasion: string }[] = [];
  for (let i = 0; i < def.productCount; i++) {
    combos.push({
      adjective: rng.pick(ADJECTIVES),
      fit: rng.pick(FITS),
      pattern: rng.pick(PATTERNS),
      occasion: rng.pick(OCCASIONS),
    });
  }

  for (let i = 0; i < def.productCount; i++) {
    const brand = eligibleBrands[i % eligibleBrands.length];
    const { adjective, fit, pattern, occasion } = combos[i];
    const productId = `p-${def.slug}-${i + 1}`;
    const singularName = def.name.replace(/s$/, '');
    const name = `${brand.name} ${adjective} ${fit} ${singularName}`;
    const slug = slugify(`${name}-${def.slug}-${i + 1}`);

    const isFlashSale = rng.bool(0.05);

    const material = rng.pick(MATERIALS);
    const mrp = rng.int(priceBand.min, priceBand.max) * (def.gender === 'kids' ? KIDS_PRICE_MULTIPLIER : 1);
    const roundedMrp = Math.round(mrp / 10) * 10 - 1;
    const discountPercent = isFlashSale ? rng.int(40, 70) : rng.bool(0.75) ? rng.int(10, 45) : 0;
    const price = Math.round((roundedMrp * (1 - discountPercent / 100)) / 10) * 10 - 1;

    const brandCode = brand.slug.split('-')[0].toUpperCase().slice(0, 4);
    const realPhotography = getRealProductPhotography(slug);
    const { variants, colors } = buildVariants(rng, productId, def, brandCode, true, realPhotography?.colors);
    const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
    const { imageSet, images } = buildProductImages(productId, name, realPhotography);

    // No more fake ratings — real ratings come from the reviews system (see RatingSummary).
    // These two draws are kept (values discarded) so every later rng call below keeps
    // producing the exact same sequence as before for every other generated field.
    rng.float(3.2, 5.0, 1);
    rng.int(8, 2400);

    const isDealOfDay = rng.bool(0.06);
    const hasVideo = rng.bool(0.16);

    const flashSaleTotalStock = isFlashSale ? rng.int(8, 40) : null;
    const flashSaleClaimed = isFlashSale && flashSaleTotalStock !== null ? rng.int(0, flashSaleTotalStock) : null;
    const flashSaleDurationMinutes = isFlashSale ? rng.int(30, 360) : null;
    const flashSaleEndsAt = isFlashSale && flashSaleDurationMinutes !== null ? new Date(Date.now() + flashSaleDurationMinutes * 60 * 1000).toISOString() : null;

    products.push({
      id: productId,
      name,
      slug,
      brand_id: brand.id,
      brand,
      category_id: category.id,
      category,
      gender: def.gender,
      description: `${adjective} ${singularName.toLowerCase()} from ${brand.name}, crafted in ${material.toLowerCase()} with a ${fit.toLowerCase()} silhouette. Designed for ${occasion.toLowerCase()} occasions with a ${pattern.toLowerCase()} finish, this piece pairs easily with the rest of your wardrobe while holding up wash after wash.`,
      sku: `${brandCode}-${slugify(def.slug).toUpperCase().slice(0, 8)}-${String(i + 1).padStart(4, '0')}`,
      mrp: Math.max(roundedMrp, 199),
      price: Math.max(price, 149),
      discount_percent: discountPercent || calculateDiscount(roundedMrp, price),
      rating: 0,
      rating_count: 0,
      total_stock: totalStock,
      // Standard Indian GST slabs for apparel: 5% up to ₹1000, 12% above — not a random draw.
      gst_percent: price > 1000 ? 12 : 5,
      low_stock_threshold: 5,
      is_active: true,
      is_featured: rng.bool(0.15),
      is_bestseller: rng.bool(0.14),
      is_new_arrival: rng.bool(0.18),
      is_trending: rng.bool(0.1),
      is_deal_of_day: isDealOfDay,
      deal_ends_at: isDealOfDay ? new Date(Date.now() + rng.int(2, 48) * 60 * 60 * 1000).toISOString() : null,
      is_flash_sale: isFlashSale,
      flash_sale_ends_at: flashSaleEndsAt,
      flash_sale_total_stock: flashSaleTotalStock,
      flash_sale_claimed: flashSaleClaimed,
      specifications: {
        material,
        fit,
        wash_care: washCareFor(material),
        pattern,
        occasion,
        country_of_origin: 'India',
      },
      tags: [pattern.toLowerCase(), fit.toLowerCase(), occasion.toLowerCase(), ...colors.map((c) => c.name.toLowerCase())],
      video_url: hasVideo ? PRODUCT_VIDEO_URL : null,
      // Real 360° turntable photography isn't available yet — this stays unset (not synthetically
      // generated) until a spin sequence is uploaded; the 360 viewer simply stays dormant until then.
      spin_frames: undefined,
      imageUrl: imageSet.imageUrl,
      thumbnailUrl: imageSet.thumbnailUrl,
      galleryImages: imageSet.galleryImages,
      created_at: new Date(Date.now() - rng.int(0, 200) * 24 * 60 * 60 * 1000).toISOString(),
      images,
      variants,
    });
  }

  return products;
}

export interface Catalog {
  brands: Brand[];
  categories: Category[];
  products: Product[];
}

let cachedCatalog: Catalog | null = null;

export function buildCatalog(): Catalog {
  if (cachedCatalog) return cachedCatalog;

  const rng = new SeededRng(CATALOG_SEED);
  const brands = buildBrands();
  const categories = buildCategories();
  const products: Product[] = [];

  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

  [...MEN_CATEGORY_DEFS, ...KIDS_CATEGORY_DEFS].forEach((def) => {
    const category = categoryBySlug.get(def.slug);
    if (!category) return;
    products.push(...buildProductsForCategory(rng, def, category, brands));
  });

  cachedCatalog = { brands, categories, products };
  return cachedCatalog;
}

export function estimatedDeliveryFor(pincode: string): string {
  const days = pincode && pincode.startsWith('1') ? 2 : 4;
  return estimateDeliveryDate(days);
}
