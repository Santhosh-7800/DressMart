/**
 * Seeds/updates the curated Bottom Wear (Slim/Regular Jeans, Cargo Pants, Joggers, Shorts, Formal
 * Pants), Outerwear (Blazers, Jackets, Hoodies, Sweatshirts), Ethnic Wear (Kurta, Sherwani),
 * Innerwear, Belts, and Vests batch — see curatedApparelData.ts for the full product list.
 *
 * Talks to Firestore via its REST API directly (not the Admin SDK) — see
 * seedCuratedShirtsTshirts.ts's docstring for why: this environment's gRPC transport is unreliable
 * against the emulator, while REST has proven reliably healthy throughout this whole seeding effort.
 *
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=localhost:8081 npx tsx scripts/seedCuratedApparel.ts
 */
import 'dotenv/config';
import { BRAND_DEFS, MEN_CATEGORY_DEFS, SIZE_SETS, type CategoryDef } from '../src/data/catalogSource.js';
import { PRODUCT_IMAGE_MANIFEST } from '../src/data/productImageManifest.js';
import { SeededRng, hashStringToSeed } from '../src/lib/seededRandom.js';
import { slugify, calculateDiscount } from '../src/lib/utils.js';
import { resolveProductImagePath, PLACEHOLDER_IMAGE_PATH } from '../src/lib/productImages.js';
import { sellerFor, PRICE_BANDS } from './seedFirestore.js';
import { CURATED_APPAREL, type CuratedApparelItem } from './curatedApparelData.js';
import { pathToFileURL } from 'node:url';

const MEN_BRANDS = BRAND_DEFS.filter((b) => b.focus === 'both' || b.focus === 'men');
const SUBCATEGORY_NAME_BY_SLUG = new Map(MEN_CATEGORY_DEFS.map((def) => [def.slug, def.name]));
const CATEGORY_DEF_BY_SLUG = new Map(MEN_CATEGORY_DEFS.map((def) => [def.slug, def]));

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'demo-dressmart';

// --- Firestore REST helpers (same approach/rationale as seedCuratedShirtsTshirts.ts) ----------
function toFirestoreValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === 'object') return { mapValue: { fields: toFirestoreFields(value as Record<string, unknown>) } };
  throw new Error(`Unsupported value type for Firestore REST write: ${typeof value}`);
}

function toFirestoreFields(obj: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    fields[key] = toFirestoreValue(value);
  }
  return fields;
}

function fromFirestoreValue(value: Record<string, unknown>): unknown {
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('arrayValue' in value) {
    const arr = (value.arrayValue as { values?: Record<string, unknown>[] }).values ?? [];
    return arr.map(fromFirestoreValue);
  }
  if ('mapValue' in value) {
    return fromFirestoreFields((value.mapValue as { fields?: Record<string, Record<string, unknown>> }).fields ?? {});
  }
  return null;
}

function fromFirestoreFields(fields: Record<string, Record<string, unknown>>): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) obj[key] = fromFirestoreValue(value);
  return obj;
}

function docUrl(collection: string, docId: string): string {
  if (!EMULATOR_HOST) throw new Error('This script requires FIRESTORE_EMULATOR_HOST to be set.');
  return `http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 8, timeoutMs = 10_000): Promise<Response> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (res.status >= 500 || res.status === 409) {
        if (attempt === attempts) return res;
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        continue;
      }
      return res;
    } catch (error) {
      clearTimeout(timer);
      if (attempt === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw new Error(`unreachable: fetchWithRetry exhausted attempts for ${url}`);
}

async function restGet(collection: string, docId: string): Promise<Record<string, unknown> | null> {
  const res = await fetchWithRetry(docUrl(collection, docId), { headers: { Authorization: 'Bearer owner' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`REST read failed for ${collection}/${docId}: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { fields?: Record<string, Record<string, unknown>> };
  return fromFirestoreFields(json.fields ?? {});
}

async function restSet(collection: string, docId: string, data: Record<string, unknown>): Promise<void> {
  const res = await fetchWithRetry(docUrl(collection, docId), {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) throw new Error(`REST write failed for ${collection}/${docId}: ${res.status} ${await res.text()}`);
}

/** Matches "SJ001-1.jpg" (index=1) and a bare "HD001.webp" (index defaults to 1) — same convention
 *  as generateImageManifest.ts's own FILENAME_PATTERN, needed here because the manifest's exported
 *  array is just an ordered list of filenames with no index metadata attached. */
const FILENAME_INDEX_PATTERN = /^[A-Za-z]+\d+(?:-(\d+))?\.(\w+)$/;
/** Preference order when two files claim the same index (e.g. a photo re-uploaded in two formats,
 *  or an old leftover bare-name file colliding with a newly-uploaded numbered set) — broadest
 *  runtime/browser compatibility first. */
const FORMAT_PRIORITY: Record<string, number> = { jpg: 0, jpeg: 0, png: 1, webp: 2, avif: 3 };

/** Real, on-disk photos for exactly this item's own code — deduplicated to exactly one file per
 *  gallery position (Front/Back/Side/Model), preferring the most broadly-compatible format if two
 *  files claim the same position. Never another product's images. */
function realPhotosFor(item: CuratedApparelItem): string[] {
  const files = PRODUCT_IMAGE_MANIFEST.men?.[item.folderKey]?.[item.sku] ?? [];
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
  return ordered.map((f) => resolveProductImagePath('men', item.categorySlug, f));
}

const FABRIC_BY_SLUG: Record<string, string> = {
  'slim-jeans': '98% Cotton, 2% Elastane',
  'regular-jeans': '99% Cotton, 1% Elastane',
  'cargo-pants': '100% Cotton',
  joggers: '80% Cotton, 20% Polyester',
  shorts: '100% Polyester',
  'formal-pants': '70% Polyester, 30% Viscose',
  blazers: '65% Polyester, 33% Viscose, 2% Elastane',
  jackets: '100% Polyester',
  hoodies: '80% Cotton, 20% Polyester',
  sweatshirts: '80% Cotton, 20% Polyester',
  kurtas: '100% Cotton',
  sherwanis: 'Silk Blend',
  innerwear: '95% Cotton, 5% Elastane',
  belts: 'Genuine Leather',
  vests: '100% Cotton',
};
const FIT_BY_SLUG: Record<string, string> = {
  'slim-jeans': 'Slim Fit',
  'regular-jeans': 'Regular Fit',
  'cargo-pants': 'Regular Fit',
  joggers: 'Relaxed Fit',
  shorts: 'Regular Fit',
  'formal-pants': 'Regular Fit',
  blazers: 'Tailored Fit',
  jackets: 'Regular Fit',
  hoodies: 'Regular Fit',
  sweatshirts: 'Regular Fit',
  kurtas: 'Regular Fit',
  sherwanis: 'Tailored Fit',
  innerwear: 'Regular Fit',
  belts: 'Adjustable',
  vests: 'Regular Fit',
};
const OCCASION_BY_SLUG: Record<string, string> = {
  'slim-jeans': 'Casual',
  'regular-jeans': 'Casual',
  'cargo-pants': 'Casual',
  joggers: 'Athleisure',
  shorts: 'Athleisure',
  'formal-pants': 'Formal',
  blazers: 'Formal',
  jackets: 'Casual',
  hoodies: 'Casual',
  sweatshirts: 'Casual',
  kurtas: 'Ethnic',
  sherwanis: 'Ethnic',
  innerwear: 'Everyday',
  belts: 'Everyday',
  vests: 'Everyday',
};

function specsFor(item: CuratedApparelItem) {
  return {
    fabric: FABRIC_BY_SLUG[item.categorySlug] ?? '100% Cotton',
    fit: FIT_BY_SLUG[item.categorySlug] ?? 'Regular Fit',
    pattern: 'Solid',
    occasion: OCCASION_BY_SLUG[item.categorySlug] ?? 'Casual',
    country_of_origin: 'India',
    wash_care: item.categorySlug === 'belts' ? 'Wipe clean with a soft, dry cloth.' : 'Machine wash cold with like colors. Do not bleach. Tumble dry low.',
  };
}

export async function main() {
  console.log('DressMart — seeding curated Bottom Wear / Outerwear / Ethnic Wear / Innerwear / Belts / Vests batch\n');

  const onlySkus = process.env.ONLY_SKUS
    ? new Set(process.env.ONLY_SKUS.split(',').map((s) => s.trim().toUpperCase()))
    : null;

  let inserted = 0;
  let updated = 0;
  let placeholderCount = 0;

  for (let i = 0; i < CURATED_APPAREL.length; i++) {
    const item = CURATED_APPAREL[i];
    if (onlySkus && !onlySkus.has(item.sku.toUpperCase())) continue;
    const photos = realPhotosFor(item);
    const imagePending = photos.length === 0;
    if (imagePending) {
      console.warn(`  ! Image Pending for ${item.sku} (${item.name}) — no images found on disk for ${item.folderKey}/${item.sku}; using placeholder.`);
      placeholderCount++;
    }

    const docId = `curated-${item.categorySlug}-${item.sku.toLowerCase()}`;
    const existingData = await restGet('products', docId);
    const isNew = existingData === null;

    const brand = item.brandSlug ? BRAND_DEFS.find((b) => b.slug === item.brandSlug) : undefined;
    if (item.brandSlug && !brand) throw new Error(`Unknown brandSlug "${item.brandSlug}" for ${item.sku} — add it to BRAND_DEFS first.`);
    const resolvedBrand = brand ?? MEN_BRANDS[i % MEN_BRANDS.length];
    const brandId = `brand-${BRAND_DEFS.findIndex((b) => b.slug === resolvedBrand.slug) + 1}`;
    const seller = sellerFor(resolvedBrand.slug);
    const rng = new SeededRng(hashStringToSeed(item.sku));

    const categoryDef = CATEGORY_DEF_BY_SLUG.get(item.categorySlug) as CategoryDef;
    const sizes = SIZE_SETS[categoryDef.sizeSet];

    const priceBandKey = categoryDef.garmentType in PRICE_BANDS ? categoryDef.garmentType : 'default';
    const priceBand = PRICE_BANDS[priceBandKey];
    const mrpRaw = rng.int(priceBand.min, priceBand.max);
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
    const tags = [item.categorySlug.replace(/-/g, ' '), item.color.toLowerCase()];
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
      description: `${item.name} in ${item.color.toLowerCase()} — from ${resolvedBrand.name}, built for everyday wear with a comfortable ${(FIT_BY_SLUG[item.categorySlug] ?? 'regular fit').toLowerCase()} and a durable, breathable finish.`,
      sku: item.sku,
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

    await restSet('products', docId, product);
    await restSet('inventory', docId, {
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
  console.log(`\n✔ ${inserted + updated}/${CURATED_APPAREL.length} curated apparel products written.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
