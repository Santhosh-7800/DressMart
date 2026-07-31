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
import { pathToFileURL } from 'node:url';

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const MEN_BRANDS = BRAND_DEFS.filter((b) => b.focus === 'both' || b.focus === 'men');
const SUBCATEGORY_NAME_BY_SLUG = new Map(MEN_CATEGORY_DEFS.map((def) => [def.slug, def.name]));

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'demo-dressmart';

/**
 * This script talks to Firestore via its REST API directly rather than through the Admin SDK: in
 * this environment the SDK's gRPC transport is unreliable against the emulator (spurious
 * "2 UNKNOWN" errors, and each internal retry can hang for minutes under the client's own retry
 * budget — compounding badly with BulkWriter's streaming model). The emulator's REST endpoint has
 * been confirmed reliably healthy throughout this seeding effort, so we use it exclusively here.
 */
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

/** The emulator has been observed to intermittently hang individual requests indefinitely under
 *  load (a resource-exhaustion pattern, not a permanent outage — most requests do eventually
 *  succeed). Each attempt is capped with an AbortController timeout, and retried with backoff
 *  rather than left to hang forever, so a few slow requests don't stall the whole batch. */
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
    const existingData = await restGet('products', docId);
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

    await restSet('products', docId, product);
    await restSet('inventory', docId, {
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
