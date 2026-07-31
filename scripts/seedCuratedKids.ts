/**
 * Seeds/updates the curated Kids batch (T-Shirts, Shorts, Hoodies, Shirts, Jeans, Party Wear,
 * Joggers, Jackets, School Uniform) — see curatedKidsData.ts for the full product list. Additive,
 * like every other curated batch: it upserts by a deterministic doc ID
 * (`curated-<categorySlug>-<sku>`) and never touches the generic, randomly-seeded Kids products
 * scripts/seedFirestore.ts already writes — nothing here removes or renumbers existing products.
 *
 * Firestore reads/writes go through scripts/lib/firestoreDocStore.ts, which is REST-based against
 * the local emulator (gRPC has proven unreliable there — see that module's docstring) and uses the
 * Admin SDK against a real project.
 *
 * Two deliberate deviations from a literal "generate realistic ratings/reviews" reading:
 *  - `rating`/`rating_count` are seeded at 0, matching every other product in this catalog — ratings
 *    are computed live from the `reviews` collection (see README's "Known limitations"), so a
 *    fabricated non-zero rating with no backing reviews would be fake data, not "realistic" data.
 *  - Sizes use the catalog's existing `kids-age` set (`2-3Y`..`14-15Y`) rather than 13 new individual
 *    per-year sizes, so the Kids size filter facet stays a single consistent taxonomy across every
 *    Kids product instead of fragmenting into two incompatible schemes for old vs. new items.
 *
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=localhost:8081 npx tsx scripts/seedCuratedKids.ts
 */
import 'dotenv/config';
import { BRAND_DEFS, KIDS_CATEGORY_DEFS, SIZE_SETS, type CategoryDef } from '../frontend/src/data/catalogSource.js';
import { PRODUCT_IMAGE_MANIFEST } from '../frontend/src/data/productImageManifest.js';
import { SeededRng, hashStringToSeed } from '../frontend/src/lib/seededRandom.js';
import { slugify, calculateDiscount } from '../frontend/src/lib/utils.js';
import { resolveProductImagePath, PLACEHOLDER_IMAGE_PATH } from '../frontend/src/lib/productImages.js';
import { sellerFor, PRICE_BANDS, KIDS_PRICE_MULTIPLIER, washCareFor } from './seedFirestore.js';
import { CURATED_KIDS, type CuratedKidsItem } from './curatedKidsData.js';
import { docGet, docSet } from './lib/firestoreDocStore.js';
import { pathToFileURL } from 'node:url';

const KIDS_BRANDS = BRAND_DEFS.filter((b) => b.focus === 'both' || b.focus === 'kids');
const SUBCATEGORY_NAME_BY_SLUG = new Map(KIDS_CATEGORY_DEFS.map((def) => [def.slug, def.name]));
const CATEGORY_DEF_BY_SLUG = new Map(KIDS_CATEGORY_DEFS.map((def) => [def.slug, def]));

/** Matches "KT001-1.jpg" (index=1) and a bare "KS001.jpg" (index defaults to 1) — same convention
 *  as generateImageManifest.ts's own FILENAME_PATTERN, needed here because the manifest's exported
 *  array is just an ordered list of filenames with no index metadata attached. */
const FILENAME_INDEX_PATTERN = /^[A-Za-z]+\d+(?:-(\d+))?\.(\w+)$/;
/** Preference order when two files claim the same index — broadest runtime/browser compatibility
 *  first (same priority order as every other curated seed script in this repo). */
const FORMAT_PRIORITY: Record<string, number> = { jpg: 0, jpeg: 0, png: 1, webp: 2, avif: 3 };

/** Real, on-disk photos for exactly this item's own code — deduplicated to exactly one file per
 *  gallery position, preferring the most broadly-compatible format if two files claim the same
 *  position. Never another product's images. */
function realPhotosFor(item: CuratedKidsItem): string[] {
  const files = PRODUCT_IMAGE_MANIFEST.kids?.[item.folderKey]?.[item.sku] ?? [];
  const byIndex = new Map<number, { file: string; priority: number }>();
  for (const file of files) {
    const match = FILENAME_INDEX_PATTERN.exec(file);
    if (!match) continue;
    const index = match[1] ? Number(match[1]) : 1;
    const ext = match[2].toLowerCase();
    const priority = FORMAT_PRIORITY[ext] ?? 99;
    const existing = byIndex.get(index);
    if (!existing || priority < existing.priority) byIndex.set(index, { file, priority });
  }
  const ordered = [...byIndex.entries()].sort(([a], [b]) => a - b).map(([, v]) => v.file);
  return ordered.map((f) => resolveProductImagePath('kids', item.categorySlug, f));
}

const FABRIC_BY_SLUG: Record<string, string> = {
  'kids-tshirts': '100% Cotton',
  'kids-shorts': 'Cotton Blend',
  'kids-hoodies': 'Fleece',
  'kids-shirts': '100% Cotton',
  'kids-jeans': 'Denim',
  'kids-party-wear': 'Cotton Blend',
  'kids-joggers': '80% Cotton, 20% Polyester',
  'kids-jackets': 'Polyester Blend',
  'school-uniform': 'Cotton Blend',
};
const FIT_BY_SLUG: Record<string, string> = {
  'kids-tshirts': 'Regular Fit',
  'kids-shorts': 'Regular Fit',
  'kids-hoodies': 'Oversized Fit',
  'kids-shirts': 'Regular Fit',
  'kids-jeans': 'Slim Fit',
  'kids-party-wear': 'Regular Fit',
  'kids-joggers': 'Relaxed Fit',
  'kids-jackets': 'Regular Fit',
  'school-uniform': 'Regular Fit',
};
const OCCASION_BY_SLUG: Record<string, string> = {
  'kids-tshirts': 'Casual',
  'kids-shorts': 'Casual',
  'kids-hoodies': 'Casual',
  'kids-shirts': 'Casual',
  'kids-jeans': 'Casual',
  'kids-party-wear': 'Party',
  'kids-joggers': 'Casual',
  'kids-jackets': 'Casual',
  'school-uniform': 'Formal',
};

function specsFor(item: CuratedKidsItem) {
  const fabric = FABRIC_BY_SLUG[item.categorySlug] ?? '100% Cotton';
  return {
    fabric,
    fit: FIT_BY_SLUG[item.categorySlug] ?? 'Regular Fit',
    pattern: 'Printed',
    occasion: OCCASION_BY_SLUG[item.categorySlug] ?? 'Casual',
    country_of_origin: 'India',
    wash_care: washCareFor(fabric),
  };
}

export async function main() {
  console.log('DressMart — seeding curated Kids batch (T-Shirts, Shorts, Hoodies, Shirts, Jeans, Party Wear, Joggers, Jackets, School Uniform)\n');

  const onlySkus = process.env.ONLY_SKUS
    ? new Set(process.env.ONLY_SKUS.split(',').map((s) => s.trim().toUpperCase()))
    : null;

  let inserted = 0;
  let updated = 0;
  let placeholderCount = 0;

  for (let i = 0; i < CURATED_KIDS.length; i++) {
    const item = CURATED_KIDS[i];
    if (onlySkus && !onlySkus.has(item.sku.toUpperCase())) continue;
    const photos = realPhotosFor(item);
    const imagePending = photos.length === 0;
    if (imagePending) {
      console.warn(`  ! Image Pending for ${item.sku} (${item.name}) — no images found on disk for ${item.folderKey}/${item.sku}; using placeholder.`);
      placeholderCount++;
    }

    const docId = `curated-${item.categorySlug}-${item.sku.toLowerCase()}`;
    const existingData = await docGet('products', docId);
    const isNew = existingData === null;

    const brand = item.brandSlug ? BRAND_DEFS.find((b) => b.slug === item.brandSlug) : undefined;
    if (item.brandSlug && !brand) throw new Error(`Unknown brandSlug "${item.brandSlug}" for ${item.sku} — add it to BRAND_DEFS first.`);
    const resolvedBrand = brand ?? KIDS_BRANDS[i % KIDS_BRANDS.length];
    const brandId = `brand-${BRAND_DEFS.findIndex((b) => b.slug === resolvedBrand.slug) + 1}`;
    const seller = sellerFor(resolvedBrand.slug);
    const rng = new SeededRng(hashStringToSeed(item.sku));

    const categoryDef = CATEGORY_DEF_BY_SLUG.get(item.categorySlug) as CategoryDef;
    const sizes = SIZE_SETS[categoryDef.sizeSet];

    const priceBandKey = categoryDef.garmentType in PRICE_BANDS ? categoryDef.garmentType : 'default';
    const priceBand = PRICE_BANDS[priceBandKey];
    const mrpRaw = rng.int(priceBand.min, priceBand.max) * KIDS_PRICE_MULTIPLIER;
    const mrp = Math.max(Math.round(mrpRaw / 10) * 10 - 1, 199);
    const discountPercent = rng.bool(0.7) ? rng.int(10, 45) : 0;
    const price = Math.max(Math.round((mrp * (1 - discountPercent / 100)) / 10) * 10 - 1, 149);

    const slug = slugify(`${item.name}-${item.color}-${item.sku.toLowerCase()}`);

    const variants = sizes.map((size, sIdx) => ({
      id: `${docId}-v-0-${sIdx}`,
      size,
      color: item.color,
      color_hex: item.colorHex,
      sku: `${item.sku}-${size}`,
      price_override: null as number | null,
    }));
    // Total stock is fixed at 50 regardless of how many sizes this category has — split as evenly
    // as possible, with any remainder absorbed by the last size, so the sum is always exactly 50.
    const variantStock: Record<string, number> = {};
    const baseStock = Math.floor(50 / sizes.length);
    variants.forEach((v, idx) => {
      variantStock[v.id] = idx === variants.length - 1 ? 50 - baseStock * (variants.length - 1) : baseStock;
    });

    const images = imagePending
      ? [{ id: `${docId}-img-0`, url: PLACEHOLDER_IMAGE_PATH, alt: `${item.name} — image pending`, color: item.color, sort_order: 0 }]
      : photos.map((url, idx) => ({
          id: `${docId}-img-${idx}`,
          url,
          alt: `${item.name} — ${item.color}, photo ${idx + 1}`,
          color: item.color,
          sort_order: idx,
        }));

    const totalStock = Object.values(variantStock).reduce((sum, n) => sum + n, 0);
    const now = new Date().toISOString();
    const subcategoryName = SUBCATEGORY_NAME_BY_SLUG.get(item.categorySlug) ?? null;
    const specs = specsFor(item);
    const tags = [
      item.categorySlug.replace(/-/g, ' '),
      item.color.toLowerCase(),
      'kids',
      'boys',
      specs.occasion.toLowerCase(),
    ];
    if (imagePending) tags.push('image pending');

    const product = {
      id: docId,
      seller_id: seller.id,
      seller_name: seller.name,
      name: item.name,
      slug,
      brand_id: brandId,
      category_id: `cat-${item.categorySlug}`,
      subcategory: subcategoryName,
      gender: 'kids' as const,
      description: `${item.name} in ${item.color.toLowerCase()} — from ${resolvedBrand.name}, made with ${specs.fabric.toLowerCase()} for a comfortable ${specs.fit.toLowerCase()}, perfect for ${specs.occasion.toLowerCase()} wear.`,
      sku: item.sku,
      mrp,
      price,
      discount_percent: discountPercent || calculateDiscount(mrp, price),
      gst_percent: price > 1000 ? 12 : 5,
      cod_available: true,
      // Seeded at 0 like every other product in this catalog — ratings are computed live from the
      // `reviews` collection, not fabricated (see this file's top docstring).
      rating: 0,
      rating_count: 0,
      status: 'active' as const,
      is_active: true,
      is_bestseller: false,
      is_new_arrival: true,
      is_trending: false,
      is_featured: false,
      is_deal_of_day: false,
      deal_ends_at: null,
      is_return_eligible: true,
      is_exchange_eligible: true,
      specifications: specs,
      tags,
      video_url: null,
      coverImage: images[0]?.url || '',
      imageUrl: images[0]?.url || '',
      thumbnailUrl: images[0]?.url || '',
      created_at: isNew ? now : ((existingData?.created_at as string) || now),
      updated_at: now,
      images,
      variants,
    };

    await docSet('products', docId, product);
    await docSet('inventory', docId, {
      product_id: docId,
      seller_id: seller.id,
      total_stock: totalStock,
      variant_stock: variantStock,
      low_stock_threshold: 10,
      updated_at: now,
    });

    if (isNew) inserted++;
    else updated++;
    console.log(`  ${isNew ? '+ added' : '~ updated'}  ${item.sku}  ${item.name}  (${item.color}, ${images.length} images)${imagePending ? ' [IMAGE PENDING]' : ''}`);
  }

  console.log('\n=== FINAL REPORT ===');
  console.log(`Total products added:   ${inserted}`);
  console.log(`Total products updated: ${updated}`);
  console.log(`Total products with a placeholder image (no real photos found): ${placeholderCount}`);
  console.log(`\n✔ ${inserted + updated}/${CURATED_KIDS.length} curated Kids products written.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
