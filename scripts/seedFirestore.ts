/**
 * DressMart Firestore seed script.
 *
 * Populates brands/categories/products/inventory so the storefront isn't empty after the
 * Supabase -> Firebase migration. Reuses the same fictional brand/category roster and real product
 * photography manifest as the old mock catalog (src/data/catalogSource.ts, src/lib/productImages.ts,
 * src/data/productImageManifest.ts) but writes it directly in the *new* schema (Product has no
 * stock field — see types/database.ts — stock lives in its own paired `inventory/{productId}` doc).
 *
 * This intentionally does NOT reuse the old src/lib/catalogGenerator.ts (deleted) — that generator's
 * real-photography binding depends on reproducing its exact seeded-RNG call sequence, which would
 * be fragile to replicate faithfully from scratch and isn't worth it here. Instead, real photos
 * (see public/images/products/) are assigned round-robin per category folder — still genuine
 * on-disk images, just not hand-verified per specific generated product/color the way the old
 * REAL_PRODUCT_PHOTOGRAPHY map was.
 *
 * Each category is capped at CATEGORY_PRODUCT_CAP products (rather than the old catalog's up to
 * 200/category) — a few hundred products total is plenty to demo browse/filter/pagination without
 * a multi-thousand-doc seed taking ages to write or read back.
 *
 * Usage:
 *   1. Either run against the local emulators (recommended for a first try):
 *        firebase emulators:start   (in one terminal)
 *        FIRESTORE_EMULATOR_HOST=localhost:8081 npm run seed   (in another)
 *      firebase-admin auto-detects FIRESTORE_EMULATOR_HOST and skips real credentials entirely.
 *   2. Or against a real project: set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON key
 *      path, set VITE_FIREBASE_PROJECT_ID in .env, then `npm run seed`.
 *
 * You normally don't need to run this by hand at all in dev — scripts/ensureSeeded.ts runs it
 * automatically (only when the `products` collection is empty) as part of `npm run dev`'s predev
 * hook. This file's own `main()` is exported so that script can call it directly.
 */
import 'dotenv/config';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { BRAND_DEFS, MEN_CATEGORY_DEFS, KIDS_CATEGORY_DEFS, SIZE_SETS, COLOR_PALETTE, MATERIALS, FITS, PATTERNS, OCCASIONS, ADJECTIVES, type CategoryDef } from '../src/data/catalogSource';
import { SeededRng } from '../src/lib/seededRandom';
import { slugify, calculateDiscount } from '../src/lib/utils';
import { getImageFolder, PLACEHOLDER_IMAGE_PATH } from '../src/lib/productImages';
import { PRODUCT_IMAGE_MANIFEST } from '../src/data/productImageManifest';

const SEED = 20260722;
const CATEGORY_PRODUCT_CAP = 18;

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'demo-dressmart';

if (!process.env.FIRESTORE_EMULATOR_HOST && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(
    '\n✖ No Firestore target configured.\n' +
      '  Either start the emulators and set FIRESTORE_EMULATOR_HOST=localhost:8081, or set\n' +
      '  GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON key for a real project.\n',
  );
  process.exit(1);
}

initializeApp({ projectId: PROJECT_ID });
/** Exported so other seed scripts (e.g. seedCuratedFormalShirts.ts) reuse this same app/db instance
 *  instead of calling initializeApp() a second time, which firebase-admin doesn't allow. */
export const db = getFirestore();

// --- Fictional seller roster the seeded catalog is distributed across (no real Auth users behind
// these — fine for storefront display; a real seller's own dashboard only ever queries their own
// seller_id, so these never show up there). Exported so other seed scripts (e.g.
// seedCuratedFormalShirts.ts) distribute their products across the same roster consistently. ---
export const SELLERS = [
  { id: 'seed-seller-northfield', name: 'Northfield Direct' },
  { id: 'seed-seller-urban-threadworks', name: 'Urban Threadworks Store' },
  { id: 'seed-seller-kids-world', name: 'Kids World Retail' },
  { id: 'seed-seller-dressmart-marketplace', name: 'DressMart Marketplace Co.' },
];

export function sellerFor(brandSlug: string): (typeof SELLERS)[number] {
  let hash = 0;
  for (let i = 0; i < brandSlug.length; i++) hash = (hash * 31 + brandSlug.charCodeAt(i)) >>> 0;
  return SELLERS[hash % SELLERS.length];
}

export const PRICE_BANDS: Record<string, { min: number; max: number }> = {
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

export function washCareFor(material: string): string {
  if (material.includes('Wool')) return 'Dry clean only. Do not bleach. Iron on low heat.';
  if (material.includes('Denim')) return 'Machine wash cold, inside out. Do not tumble dry. Iron on reverse.';
  if (material.includes('Linen')) return 'Hand wash or gentle machine cycle. Line dry in shade. Iron while damp.';
  return 'Machine wash cold with like colors. Do not bleach. Tumble dry low.';
}

function eligibleBrands(gender: 'men' | 'kids'): typeof BRAND_DEFS {
  return BRAND_DEFS.filter((b) => b.focus === 'both' || b.focus === gender);
}

/** Real photo sets for this category's folder, round-robin assigned across products so every
 *  seeded product that has *any* real photography gets a distinct, genuine set of on-disk images. */
function realPhotoSetsFor(gender: 'men' | 'kids', categorySlug: string): string[][] {
  const folder = getImageFolder(categorySlug);
  const byCode = PRODUCT_IMAGE_MANIFEST[gender]?.[folder] ?? {};
  return Object.values(byCode);
}

interface GeneratedVariant {
  id: string;
  size: string;
  color: string;
  color_hex: string;
  sku: string;
  price_override: number | null;
}

function buildCategoryDoc(def: CategoryDef, parentId: string, sortOrder: number) {
  return {
    id: `cat-${def.slug}`,
    name: def.name,
    slug: def.slug,
    gender: def.gender,
    parent_id: parentId,
    image_url: null,
    sort_order: sortOrder,
  };
}

export async function main() {
  console.log(`DressMart — seeding Firestore project "${PROJECT_ID}"\n`);
  const rng = new SeededRng(SEED);
  const bulkWriter = db.bulkWriter();
  let productCount = 0;

  // --- Brands ---
  console.log('Seeding brands...');
  BRAND_DEFS.forEach((b, idx) => {
    const ref = db.collection('brands').doc(`brand-${idx + 1}`);
    bulkWriter.set(ref, { id: ref.id, name: b.name, slug: b.slug, logo_url: null, description: b.description, is_featured: b.isFeatured });
  });
  const brandIdBySlug = new Map(BRAND_DEFS.map((b, idx) => [b.slug, `brand-${idx + 1}`]));

  // --- Categories (parents, then children) ---
  console.log('Seeding categories...');
  bulkWriter.set(db.collection('categories').doc('cat-men'), { id: 'cat-men', name: 'Men', slug: 'men', gender: 'men', parent_id: null, image_url: null, sort_order: 0 });
  bulkWriter.set(db.collection('categories').doc('cat-kids'), { id: 'cat-kids', name: 'Kids', slug: 'kids', gender: 'kids', parent_id: null, image_url: null, sort_order: 1 });
  const allCategoryDefs = [...MEN_CATEGORY_DEFS, ...KIDS_CATEGORY_DEFS];
  allCategoryDefs.forEach((def, idx) => {
    const doc = buildCategoryDoc(def, def.gender === 'men' ? 'cat-men' : 'cat-kids', idx + 2);
    bulkWriter.set(db.collection('categories').doc(doc.id), doc);
  });

  // --- Products + Inventory ---
  console.log(`Seeding products (capped at ${CATEGORY_PRODUCT_CAP}/category)...`);
  for (const def of allCategoryDefs) {
    const categoryId = `cat-${def.slug}`;
    const brands = eligibleBrands(def.gender);
    const sizes = SIZE_SETS[def.sizeSet];
    const priceBand = PRICE_BANDS[def.garmentType] ?? PRICE_BANDS.default;
    const photoSets = realPhotoSetsFor(def.gender, def.slug);
    const count = Math.min(def.productCount, CATEGORY_PRODUCT_CAP);

    for (let i = 0; i < count; i++) {
      const brandDef = brands[i % brands.length];
      const brandId = brandIdBySlug.get(brandDef.slug)!;
      const seller = sellerFor(brandDef.slug);
      const adjective = rng.pick(ADJECTIVES);
      const fit = rng.pick(FITS);
      const pattern = rng.pick(PATTERNS);
      const occasion = rng.pick(OCCASIONS);
      const material = rng.pick(MATERIALS);
      const singularName = def.name.replace(/s$/, '');
      const name = `${brandDef.name} ${adjective} ${fit} ${singularName}`;

      const ref = db.collection('products').doc();
      const slug = slugify(`${name}-${ref.id.slice(0, 6)}`);

      const mrpRaw = rng.int(priceBand.min, priceBand.max) * (def.gender === 'kids' ? KIDS_PRICE_MULTIPLIER : 1);
      const mrp = Math.max(Math.round(mrpRaw / 10) * 10 - 1, 199);
      const discountPercent = rng.bool(0.7) ? rng.int(10, 45) : 0;
      const price = Math.max(Math.round((mrp * (1 - discountPercent / 100)) / 10) * 10 - 1, 149);

      const colorCount = def.sizeSet === 'onesize' || def.sizeSet === 'belt' ? rng.int(2, 3) : rng.int(2, 4);
      const colors = rng.pickMany(COLOR_PALETTE, colorCount);

      const variants: GeneratedVariant[] = [];
      const variantStock: Record<string, number> = {};
      colors.forEach((color, colorIdx) => {
        sizes.forEach((size, sizeIdx) => {
          const variantId = `${ref.id}-v-${colorIdx}-${sizeIdx}`;
          const stock = rng.int(0, 60);
          const priceOverride = rng.bool(0.05) ? rng.int(1, 5) * 100 : null;
          variants.push({
            id: variantId,
            size,
            color: color.name,
            color_hex: color.hex,
            sku: `${brandDef.slug.split('-')[0].toUpperCase().slice(0, 4)}-${slugify(def.slug).toUpperCase().slice(0, 6)}-${color.name.replace(/\s+/g, '').slice(0, 3).toUpperCase()}-${size.replace(/\s+/g, '')}`,
            price_override: priceOverride,
          });
          variantStock[variantId] = stock;
        });
      });
      const totalStock = Object.values(variantStock).reduce((sum, n) => sum + n, 0);

      const isDealOfDay = rng.bool(0.05);
      const isReturnEligible = def.slug !== 'innerwear';

      // Real photos (if this category folder has any) round-robin assigned by product index —
      // still genuine on-disk photography, just not hand-bound to one specific generated product.
      const photoSet = photoSets.length > 0 ? photoSets[i % photoSets.length] : null;
      const images = photoSet
        ? photoSet.map((filename, idx) => ({
            id: `${ref.id}-img-${idx}`,
            url: `/images/products/${def.gender}/${getImageFolder(def.slug)}/${filename}`,
            alt: `${name} — photo ${idx + 1}`,
            color: null,
            sort_order: idx,
          }))
        : [{ id: `${ref.id}-img-0`, url: PLACEHOLDER_IMAGE_PATH, alt: `${name} — photo 1`, color: null, sort_order: 0 }];

      const now = new Date();
      const createdAt = new Date(now.getTime() - rng.int(0, 200) * 24 * 60 * 60 * 1000).toISOString();

      const product = {
        id: ref.id,
        seller_id: seller.id,
        seller_name: seller.name,
        name,
        slug,
        brand_id: brandId,
        category_id: categoryId,
        subcategory: null,
        gender: def.gender,
        description: `${adjective} ${singularName.toLowerCase()} from ${brandDef.name}, crafted in ${material.toLowerCase()} with a ${fit.toLowerCase()} silhouette. Designed for ${occasion.toLowerCase()} occasions with a ${pattern.toLowerCase()} finish.`,
        sku: `${brandDef.slug.split('-')[0].toUpperCase().slice(0, 4)}-${slugify(def.slug).toUpperCase().slice(0, 8)}-${String(i + 1).padStart(4, '0')}`,
        mrp,
        price,
        discount_percent: discountPercent || calculateDiscount(mrp, price),
        gst_percent: price > 1000 ? 12 : 5,
        cod_available: true,
        rating: 0,
        rating_count: 0,
        status: 'active' as const,
        is_active: true,
        is_bestseller: rng.bool(0.14),
        is_new_arrival: rng.bool(0.18),
        is_trending: rng.bool(0.1),
        is_featured: rng.bool(0.08),
        is_deal_of_day: isDealOfDay,
        deal_ends_at: isDealOfDay ? new Date(now.getTime() + rng.int(2, 48) * 60 * 60 * 1000).toISOString() : null,
        is_return_eligible: isReturnEligible,
        is_exchange_eligible: isReturnEligible,
        specifications: { fabric: material, fit, wash_care: washCareFor(material), pattern, occasion, country_of_origin: 'India' },
        tags: [...new Set([pattern.toLowerCase(), fit.toLowerCase(), occasion.toLowerCase(), ...colors.map((c) => c.name.toLowerCase())])],
        video_url: null,
        coverImage: images[0].url,
        imageUrl: images[0].url,
        thumbnailUrl: images[0].url,
        created_at: createdAt,
        updated_at: createdAt,
        images,
        variants,
      };

      bulkWriter.set(ref, product);
      bulkWriter.set(db.collection('inventory').doc(ref.id), {
        product_id: ref.id,
        seller_id: seller.id,
        total_stock: totalStock,
        variant_stock: variantStock,
        low_stock_threshold: 5,
        updated_at: createdAt,
      });
      productCount++;
    }
    console.log(`  ✓ ${def.name}: ${count} products`);
  }

  await bulkWriter.close();
  console.log(`\n✔ Seed complete — ${BRAND_DEFS.length} brands, ${allCategoryDefs.length + 2} categories, ${productCount} products + matching inventory docs.`);
}

// Guarded so other seed scripts can import this module's exports (SELLERS, sellerFor, PRICE_BANDS,
// washCareFor) without re-triggering the full catalog seed as a side effect.
import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
