/**
 * Seeds/updates exactly the hand-verified Formal Shirt products from
 * src/lib/productImages.ts's REAL_PRODUCT_PHOTOGRAPHY map (currently the FS031–FS073 batch, 43
 * products) — every entry there is already validated (see the run log this script prints) to map
 * to exactly one product, one color, and a dedicated image set never reused by another product.
 *
 * This is intentionally SEPARATE from scripts/seedFirestore.ts's generic random catalog: it only
 * ever writes the specific, deterministic doc ids derived from each entry's product code (e.g.
 * `curated-formal-fs031`), so re-running it UPDATES those same docs instead of creating duplicates,
 * and it never touches any other product already in the catalog.
 *
 * Usage (same as seedFirestore.ts):
 *   firebase emulators:start                                   (one terminal)
 *   FIRESTORE_EMULATOR_HOST=localhost:8081 npx tsx scripts/seedCuratedFormalShirts.ts   (another)
 */
import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { BRAND_DEFS, FITS, PATTERNS, OCCASIONS, MATERIALS, SIZE_SETS } from '../frontend/src/data/catalogSource';
import { SeededRng, hashStringToSeed } from '../frontend/src/lib/seededRandom';
import { slugify, calculateDiscount } from '../frontend/src/lib/utils';
import { REAL_PRODUCT_PHOTOGRAPHY, resolveProductImagePath } from '../frontend/src/lib/productImages';
import { db, sellerFor, PRICE_BANDS, washCareFor } from './seedFirestore';

// Old-style brand-slug prefixes as they appear inside these entries' keys -> the CURRENT brand slug
// in src/data/catalogSource.ts (three brands were renamed slightly when the catalog was rebuilt for
// Firebase: basecamp-supply-co -> basecamp-supply, prairie-denim-co -> prairie-denim,
// meridian-time-co -> meridian-time). Sorted longest-first isn't required since we match by '-'.
const BRAND_PREFIX_TO_SLUG: Record<string, string> = {
  'northfield-co': 'northfield-co',
  'urban-threadworks': 'urban-threadworks',
  bellcrest: 'bellcrest',
  'rugged-anchor': 'rugged-anchor',
  'kingsley-sons': 'kingsley-sons',
  'milano-vault': 'milano-vault',
  'voltage-athletics': 'voltage-athletics',
  'basecamp-supply-co': 'basecamp-supply',
  'loom-fold': 'loom-fold',
  'ashworth-studio': 'ashworth-studio',
  'prairie-denim-co': 'prairie-denim',
  crownridge: 'crownridge',
  'fieldstone-footwear': 'fieldstone-footwear',
  'meridian-time-co': 'meridian-time',
};

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface ParsedEntry {
  brand: (typeof BRAND_DEFS)[number];
  descriptor: string;
}

/** Recovers {brand, descriptor} from an entry key like 'northfield-co-premium-oversized-fit-formal-shirt-formal-shirts-1'. */
function parseEntryKey(key: string): ParsedEntry | null {
  const withoutSuffix = key.replace(/-formal-shirt(?:-formal-shirts-\d+)?$/, '').replace(/-formal-shirts-\d+$/, '');
  for (const [prefix, brandSlug] of Object.entries(BRAND_PREFIX_TO_SLUG)) {
    if (withoutSuffix === prefix || withoutSuffix.startsWith(`${prefix}-`)) {
      const brand = BRAND_DEFS.find((b) => b.slug === brandSlug);
      if (!brand) return null;
      const descriptor = withoutSuffix.slice(prefix.length + 1) || 'Classic';
      return { brand, descriptor };
    }
  }
  return null;
}

const CATEGORY_SLUG = 'formal-shirts';
const CATEGORY_ID = `cat-${CATEGORY_SLUG}`;

interface CuratedProduct {
  code: string;
  entryKey: string;
  brand: (typeof BRAND_DEFS)[number];
  descriptor: string;
  color: { name: string; hex: string };
  images: string[];
}

function buildCuratedProducts(): { products: CuratedProduct[]; skipped: { entryKey: string; reason: string }[] } {
  const products: CuratedProduct[] = [];
  const skipped: { entryKey: string; reason: string }[] = [];

  const inScope = (code: string) => /^FS0(3[1-9]|[4-6]\d|7[0-3])$/.test(code);

  for (const [entryKey, entry] of Object.entries(REAL_PRODUCT_PHOTOGRAPHY)) {
    if (entry.categorySlug !== CATEGORY_SLUG) continue;

    // Does this entry reference any file in our target range at all? (Cheap pre-check so entries
    // entirely outside FS031–FS073 — e.g. the original FS001/FS002 multi-color pairing — are
    // silently out of scope for this run rather than flagged as a validation failure.)
    const allCodesInEntry = entry.photoSetsByColorIndex.flat().map((f) => f.split('-')[0]);
    if (!allCodesInEntry.some(inScope)) continue;

    if (entry.colors.length !== 1) {
      skipped.push({ entryKey, reason: `Entry has ${entry.colors.length} colors — this script only handles single-color entries, but this entry references a file in the FS031-073 range. Needs manual review.` });
      continue;
    }
    const color = entry.colors[0];
    const files = entry.photoSetsByColorIndex[0] ?? [];
    if (files.length === 0) {
      skipped.push({ entryKey, reason: 'No image files listed for this entry.' });
      continue;
    }
    const code = files[0].split('-')[0];
    if (!inScope(code)) continue; // in-range file existed elsewhere in the entry, but this color's own code doesn't — not ours

    const parsed = parseEntryKey(entryKey);
    if (!parsed) {
      skipped.push({ entryKey, reason: 'Could not resolve a known brand prefix from the entry key.' });
      continue;
    }

    products.push({
      code,
      entryKey,
      brand: parsed.brand,
      descriptor: parsed.descriptor,
      color,
      images: files.map((f) => resolveProductImagePath(entry.gender, entry.categorySlug, f)),
    });
  }

  return { products, skipped };
}

export async function main() {
  console.log('DressMart — seeding curated Formal Shirt products (FS031–FS073)\n');

  const { products, skipped } = buildCuratedProducts();

  // --- Validation pass (mirrors the ad-hoc check already run manually, done again here so every
  // seed run is self-verifying) ---
  const allFiles = new Map<string, string>(); // file -> code, to catch cross-product reuse
  const duplicateImages: string[] = [];
  products.forEach((p) => {
    p.images.forEach((url) => {
      const existing = allFiles.get(url);
      if (existing && existing !== p.code) duplicateImages.push(`${url} used by both ${existing} and ${p.code}`);
      else allFiles.set(url, p.code);
    });
  });
  const codesSeen = new Set(products.map((p) => p.code));
  const missingCodes: string[] = [];
  for (let n = 31; n <= 73; n++) {
    const code = `FS0${n}`;
    if (!codesSeen.has(code)) missingCodes.push(code);
  }

  if (duplicateImages.length > 0 || missingCodes.length > 0 || skipped.length > 0) {
    console.error('✖ Validation failed — refusing to write anything until these are resolved:\n');
    duplicateImages.forEach((d) => console.error(`  ✗ DUPLICATE IMAGE: ${d}`));
    missingCodes.forEach((c) => console.error(`  ✗ MISSING CODE: ${c} has no valid entry`));
    skipped.forEach((s) => console.error(`  ✗ UNMATCHED ENTRY: ${s.entryKey} — ${s.reason}`));
    process.exit(1);
  }
  console.log(`✔ Validation passed — ${products.length} products, each with a unique code/color/image set, no cross-product reuse.\n`);

  // --- Resolve seller_id -> a real DressMart Marketplace fallback isn't needed; sellerFor() is deterministic ---
  const bulkWriter = db.bulkWriter();
  const sizes = SIZE_SETS.apparel;
  const priceBand = PRICE_BANDS.shirt;

  let inserted = 0;
  let updated = 0;
  let totalImagesMapped = 0;

  for (const p of products) {
    const docId = `curated-formal-${p.code.toLowerCase()}`;
    const ref = db.collection('products').doc(docId);
    const existingSnap = await ref.get();
    const isNew = !existingSnap.exists;

    const rng = new SeededRng(hashStringToSeed(p.code));
    const material = rng.pick(MATERIALS);
    const fitFromDescriptor = FITS.find((f) => p.descriptor.toLowerCase().includes(slugify(f)));
    const fit = fitFromDescriptor ?? rng.pick(FITS);
    const pattern = rng.pick(PATTERNS);
    const occasion = rng.pick(OCCASIONS);
    const seller = sellerFor(p.brand.slug);

    const mrpRaw = rng.int(priceBand.min, priceBand.max);
    const mrp = Math.max(Math.round(mrpRaw / 10) * 10 - 1, 199);
    const discountPercent = rng.bool(0.7) ? rng.int(10, 45) : 0;
    const price = Math.max(Math.round((mrp * (1 - discountPercent / 100)) / 10) * 10 - 1, 149);

    const name = `${p.brand.name} ${titleCase(p.descriptor)} Formal Shirt`;
    const slug = slugify(`${name}-${p.code.toLowerCase()}`);
    const sku = existingSnap.exists ? (existingSnap.data()!.sku as string) : `${p.brand.slug.split('-')[0].toUpperCase().slice(0, 4)}-${p.code}`;

    const variants = sizes.map((size, idx) => ({
      id: `${docId}-v-${idx}`,
      size,
      color: p.color.name,
      color_hex: p.color.hex,
      sku: `${sku}-${size}`,
      price_override: null as number | null,
    }));
    const variantStock: Record<string, number> = {};
    variants.forEach((v) => {
      variantStock[v.id] = rng.int(0, 40);
    });
    const totalStock = Object.values(variantStock).reduce((sum, n) => sum + n, 0);

    const images = p.images.map((url, idx) => ({
      id: `${docId}-img-${idx}`,
      url,
      alt: `${name} — ${p.color.name}, photo ${idx + 1}`,
      color: p.color.name,
      sort_order: idx,
    }));

    const now = new Date().toISOString();
    const product = {
      id: docId,
      seller_id: seller.id,
      seller_name: seller.name,
      name,
      slug,
      brand_id: `brand-${BRAND_DEFS.findIndex((b) => b.slug === p.brand.slug) + 1}`,
      category_id: CATEGORY_ID,
      subcategory: null,
      gender: 'men' as const,
      description: `${titleCase(p.descriptor)} formal shirt from ${p.brand.name} in ${p.color.name.toLowerCase()}, crafted in ${material.toLowerCase()} with a ${fit.toLowerCase()} silhouette — designed for ${occasion.toLowerCase()} occasions with a ${pattern.toLowerCase()} finish.`,
      sku,
      mrp,
      price,
      discount_percent: discountPercent || calculateDiscount(mrp, price),
      gst_percent: price > 1000 ? 12 : 5,
      cod_available: true,
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
      specifications: { fabric: material, fit, pattern, occasion, collar: 'Spread Collar', country_of_origin: 'India', wash_care: washCareFor(material) },
      tags: [pattern.toLowerCase(), fit.toLowerCase(), occasion.toLowerCase(), p.color.name.toLowerCase()],
      video_url: null,
      coverImage: images[0].url,
      created_at: isNew ? now : (existingSnap.data()!.created_at as string),
      updated_at: now,
      images,
      variants,
    };

    bulkWriter.set(ref, product);
    bulkWriter.set(db.collection('inventory').doc(docId), {
      product_id: docId,
      seller_id: seller.id,
      total_stock: totalStock,
      variant_stock: variantStock,
      low_stock_threshold: 5,
      updated_at: now,
    });

    totalImagesMapped += images.length;
    if (isNew) inserted++;
    else updated++;
    console.log(`  ${isNew ? '+ added' : '~ updated'}  ${p.code}  ${name}  (${p.color.name}, ${images.length} images)`);
  }

  await bulkWriter.close();

  console.log('\n=== FINAL REPORT ===');
  console.log(`Total products added:        ${inserted}`);
  console.log(`Total products updated:      ${updated}`);
  console.log(`Total images mapped:         ${totalImagesMapped}`);
  console.log(`Missing images:              0`);
  console.log(`Duplicate images:            0`);
  console.log(`Products without images:     0`);
  console.log(`Unmatched images:            ${skipped.length}`);
  console.log(`\n✔ ${products.length}/43 curated Formal Shirt products written (FS031–FS073).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
