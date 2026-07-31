/**
 * Seeds/updates the curated Shirts/T-Shirts batch (Casual, Printed, Solid, Cotton shirts + Polo,
 * Round Neck, Oversized, Henley t-shirts) — see curatedShirtsTshirtsData.ts for the full product
 * list.
 *
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=localhost:8081 npx tsx scripts/seedCuratedShirtsTshirts.ts
 */
import 'dotenv/config';
import { BRAND_DEFS, MEN_CATEGORY_DEFS } from '../frontend/src/data/catalogSource.js';
import { PRODUCT_IMAGE_MANIFEST } from '../frontend/src/data/productImageManifest.js';
import { SeededRng, hashStringToSeed } from '../frontend/src/lib/seededRandom.js';
import { slugify, calculateDiscount } from '../frontend/src/lib/utils.js';
import { resolveProductImagePath, PLACEHOLDER_IMAGE_PATH } from '../frontend/src/lib/productImages.js';
import { sellerFor, PRICE_BANDS } from './seedFirestore.js';
import { CURATED_SHIRTS_TSHIRTS, type CuratedShirtItem } from './curatedShirtsTshirtsData.js';
import { docGet, docSet } from './lib/firestoreDocStore.js';
import { pathToFileURL } from 'node:url';

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const MEN_BRANDS = BRAND_DEFS.filter((b) => b.focus === 'both' || b.focus === 'men');
const SUBCATEGORY_NAME_BY_SLUG = new Map(MEN_CATEGORY_DEFS.map((def) => [def.slug, def.name]));


/** Real, on-disk photos for exactly this item's own code — never another product's. */
function realPhotosFor(item: CuratedShirtItem): string[] {
  const files = PRODUCT_IMAGE_MANIFEST.men?.[item.folderKey]?.[item.sku] ?? [];
  return files.map((f) => resolveProductImagePath('men', item.categorySlug, f));
}

function specsFor(item: CuratedShirtItem) {
  const patternByCategory: Record<string, string> = {
    'casual-shirts': 'Checked',
    'printed-shirts': 'Printed',
    'solid-shirts': 'Solid',
    'cotton-shirts': 'Solid',
  };
  const collarByCategory: Record<string, string> = {
    'polo-tshirts': 'Polo Collar',
    'henley-tshirts': 'Henley Neck',
    'round-neck-tshirts': 'Round Neck',
    'oversized-tshirts': 'Round Neck',
  };
  return {
    fabric: '100% Cotton',
    fit: item.categorySlug === 'oversized-tshirts' ? 'Oversized Fit' : 'Regular Fit',
    pattern: item.kind === 'shirt' ? (patternByCategory[item.categorySlug] ?? 'Solid') : 'Solid',
    occasion: 'Casual',
    collar: item.kind === 'shirt' ? 'Spread Collar' : (collarByCategory[item.categorySlug] ?? 'Round Neck'),
    country_of_origin: 'India',
    wash_care: 'Machine wash cold with like colors. Do not bleach. Tumble dry low.',
  };
}

export async function main() {
  console.log('DressMart — seeding curated Shirts/T-Shirts batch (Casual/Printed/Solid/Cotton shirts, Polo/Round Neck/Oversized/Henley t-shirts)\n');

  // Optional retry aid: ONLY_SKUS=CS007,PS001 limits this run to specific items (e.g. re-running
  // just the docs a prior emulator DEADLINE_EXCEEDED left missing, instead of all 57 again).
  const onlySkus = process.env.ONLY_SKUS
    ? new Set(process.env.ONLY_SKUS.split(',').map((s) => s.trim().toUpperCase()))
    : null;

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < CURATED_SHIRTS_TSHIRTS.length; i++) {
    const item = CURATED_SHIRTS_TSHIRTS[i];
    if (onlySkus && !onlySkus.has(item.sku.toUpperCase())) continue;
    const photos = realPhotosFor(item);
    const imagePending = photos.length === 0;
    if (imagePending) {
      console.warn(`  ! Image Pending for ${item.displaySku} (${item.name}) — no images found on disk for ${item.folderKey}/${item.sku}; using placeholder.`);
      skipped++;
    }

    const docId = `curated-${item.categorySlug}-${item.sku.toLowerCase()}`;
    const existingData = await docGet('products', docId);
    const isNew = existingData === null;

    const brand = item.brandSlug ? BRAND_DEFS.find((b) => b.slug === item.brandSlug) : undefined;
    if (item.brandSlug && !brand) throw new Error(`Unknown brandSlug "${item.brandSlug}" for ${item.displaySku} — add it to BRAND_DEFS first.`);
    const resolvedBrand = brand ?? MEN_BRANDS[i % MEN_BRANDS.length];
    const brandId = `brand-${BRAND_DEFS.findIndex((b) => b.slug === resolvedBrand.slug) + 1}`;
    const seller = sellerFor(resolvedBrand.slug);
    const rng = new SeededRng(hashStringToSeed(item.displaySku));

    const priceBand = PRICE_BANDS[item.kind === 'shirt' ? 'shirt' : 'tshirt'];
    const mrpRaw = rng.int(priceBand.min, priceBand.max);
    const mrp = Math.max(Math.round(mrpRaw / 10) * 10 - 1, 199);
    const discountPercent = rng.bool(0.7) ? rng.int(10, 45) : 0;
    const price = Math.max(Math.round((mrp * (1 - discountPercent / 100)) / 10) * 10 - 1, 149);

    const slug = slugify(`${item.name}-${item.displaySku.toLowerCase()}`);

    const variants = SIZES.map((size, sIdx) => ({
      id: `${docId}-v-0-${sIdx}`,
      size,
      color: item.color,
      color_hex: item.colorHex,
      sku: `${item.displaySku}-${size}`,
      price_override: null as number | null,
    }));
    // Shirts (Casual/Printed/Solid/Cotton): fixed 50-unit default stock split evenly across sizes,
    // per spec. T-shirts keep their pre-existing randomized stock (out of scope for this update).
    const variantStock: Record<string, number> = {};
    variants.forEach((v) => {
      variantStock[v.id] = item.kind === 'shirt' ? 10 : rng.int(5, 60);
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
    const garmentWord = item.kind === 'shirt' ? 'shirt' : 't-shirt';
    const subcategoryName = SUBCATEGORY_NAME_BY_SLUG.get(item.categorySlug) ?? null;
    const tags = [item.categorySlug.replace(/-/g, ' '), garmentWord, item.color.toLowerCase()];
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
      gender: 'men' as const,
      description: `${item.name} in ${item.color.toLowerCase()} — a ${garmentWord} from ${resolvedBrand.name}, tailored for everyday wear with a comfortable regular fit and a crisp, breathable finish.`,
      sku: item.displaySku,
      mrp,
      price,
      discount_percent: discountPercent || calculateDiscount(mrp, price),
      gst_percent: price > 1000 ? 12 : 5,
      cod_available: true,
      rating: item.kind === 'shirt' ? 0 : rng.float(3.8, 4.9),
      rating_count: item.kind === 'shirt' ? 0 : rng.int(12, 140),
      status: 'active' as const,
      is_active: true,
      is_bestseller: item.kind === 'shirt' ? false : i % 5 === 0,
      is_new_arrival: true,
      is_trending: item.kind === 'shirt' ? false : i % 6 === 0,
      is_featured: item.kind === 'shirt' ? false : i % 4 === 0,
      is_deal_of_day: false,
      deal_ends_at: null,
      is_return_eligible: true,
      is_exchange_eligible: true,
      specifications: specsFor(item),
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
      low_stock_threshold: item.kind === 'shirt' ? 10 : 5,
      updated_at: now,
    });

    if (isNew) inserted++;
    else updated++;
    console.log(`  ${isNew ? '+ added' : '~ updated'}  ${item.displaySku}  ${item.name}  (${item.color}, ${images.length} images)${imagePending ? ' [IMAGE PENDING]' : ''}`);
  }

  console.log('\n=== FINAL REPORT ===');
  console.log(`Total products added:   ${inserted}`);
  console.log(`Total products updated: ${updated}`);
  console.log(`Total products with a placeholder image (no real photos found): ${skipped}`);
  console.log(`\n✔ ${inserted + updated}/${CURATED_SHIRTS_TSHIRTS.length} curated Shirts/T-Shirts products written.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
