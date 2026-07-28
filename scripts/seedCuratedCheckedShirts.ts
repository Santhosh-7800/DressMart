/**
 * Seeds/updates the curated Checked Shirt products with real photography (CHS001–CHS030).
 *
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=localhost:8081 npx tsx scripts/seedCuratedCheckedShirts.ts
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BRAND_DEFS } from '../src/data/catalogSource.js';
import { PRODUCT_IMAGE_MANIFEST } from '../src/data/productImageManifest.js';
import { SeededRng, hashStringToSeed } from '../src/lib/seededRandom.js';
import { slugify, calculateDiscount } from '../src/lib/utils.js';
import { db, sellerFor, PRICE_BANDS } from './seedFirestore.js';
import { CURATED_CHECKED_SHIRTS, type CuratedCheckedShirt } from './curatedCheckedShirtsData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');

const CATEGORY_SLUG = 'checked-shirts';
const CATEGORY_ID = `cat-${CATEGORY_SLUG}`;
const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

const MEN_BRANDS = BRAND_DEFS.filter((b) => b.focus === 'both' || b.focus === 'men');

function getChsCode(sku: string): string {
  const num = sku.replace('CS', '');
  if (num === '015') return 'CHS014'; // CHS015 doesn't exist on disk, fallback to CHS014
  return `CHS${num}`;
}

function realPhotosForSku(sku: string): string[] {
  const chsCode = getChsCode(sku);
  const files = PRODUCT_IMAGE_MANIFEST.men?.['checked-shirts']?.[chsCode] ?? [];
  return files.map((f) => `/images/products/men/checked-shirts/${f}`);
}

export async function main() {
  console.log('DressMart — seeding curated Checked Shirt products with real photos (CHS001–CHS030)\n');

  const bulkWriter = db.bulkWriter();
  const priceBand = PRICE_BANDS.shirt;

  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < CURATED_CHECKED_SHIRTS.length; i++) {
    const p = CURATED_CHECKED_SHIRTS[i];
    const docId = `curated-checked-${p.sku.toLowerCase()}`;
    const ref = db.collection('products').doc(docId);
    const existingSnap = await ref.get();
    const isNew = !existingSnap.exists;

    const brand = MEN_BRANDS[i % MEN_BRANDS.length];
    const brandId = `brand-${BRAND_DEFS.findIndex((b) => b.slug === brand.slug) + 1}`;
    const seller = sellerFor(brand.slug);
    const rng = new SeededRng(hashStringToSeed(p.sku));

    const mrpRaw = rng.int(priceBand.min, priceBand.max);
    const mrp = Math.max(Math.round(mrpRaw / 10) * 10 - 1, 199);
    const discountPercent = rng.bool(0.7) ? rng.int(10, 45) : 0;
    const price = Math.max(Math.round((mrp * (1 - discountPercent / 100)) / 10) * 10 - 1, 149);

    const slug = slugify(`${p.name}-${p.sku.toLowerCase()}`);

    // Create 3 additional color choices for this product from neighboring curated checked items
    // so every product has color thumbnail swatches in PDP!
    const alt1 = CURATED_CHECKED_SHIRTS[(i + 1) % CURATED_CHECKED_SHIRTS.length];
    const alt2 = CURATED_CHECKED_SHIRTS[(i + 2) % CURATED_CHECKED_SHIRTS.length];
    const alt3 = CURATED_CHECKED_SHIRTS[(i + 3) % CURATED_CHECKED_SHIRTS.length];
    const colorChoices: CuratedCheckedShirt[] = [p, alt1, alt2, alt3];

    const variants: {
      id: string;
      size: string;
      color: string;
      color_hex: string;
      sku: string;
      price_override: number | null;
    }[] = [];

    const variantStock: Record<string, number> = {};
    const images: { id: string; url: string; alt: string; color: string; sort_order: number }[] = [];

    colorChoices.forEach((cItem, cIdx) => {
      const cPhotos = realPhotosForSku(cItem.sku);
      
      SIZES.forEach((size, sIdx) => {
        const vId = `${docId}-v-${cIdx}-${sIdx}`;
        variants.push({
          id: vId,
          size,
          color: cItem.color,
          color_hex: cItem.base,
          sku: `${p.sku}-${cItem.color.replace(/\s+/g, '')}-${size}`,
          price_override: null,
        });
        variantStock[vId] = rng.int(5, 50);
      });

      cPhotos.forEach((url, pIdx) => {
        images.push({
          id: `${docId}-img-${cIdx}-${pIdx}`,
          url,
          alt: `${p.name} — ${cItem.color}, photo ${pIdx + 1}`,
          color: cItem.color,
          sort_order: images.length,
        });
      });
    });

    const totalStock = Object.values(variantStock).reduce((sum, n) => sum + n, 0);
    const now = new Date().toISOString();

    const product = {
      id: docId,
      seller_id: seller.id,
      seller_name: seller.name,
      name: p.name,
      slug,
      brand_id: brandId,
      category_id: CATEGORY_ID,
      subcategory: null,
      gender: 'men' as const,
      description: `${p.name} in ${p.color.toLowerCase()} — a checked cotton shirt from ${brand.name}, tailored for everyday wear with a comfortable regular fit and a crisp, breathable finish.`,
      sku: p.sku,
      mrp,
      price,
      discount_percent: discountPercent || calculateDiscount(mrp, price),
      gst_percent: price > 1000 ? 12 : 5,
      cod_available: true,
      rating: rng.float(3.8, 4.9),
      rating_count: rng.int(12, 140),
      status: 'active' as const,
      is_active: true,
      is_bestseller: i % 4 === 0,
      is_new_arrival: true,
      is_trending: i % 5 === 0,
      is_featured: i % 3 === 0,
      is_deal_of_day: false,
      deal_ends_at: null,
      is_return_eligible: true,
      is_exchange_eligible: true,
      specifications: {
        fabric: '100% Cotton',
        fit: 'Regular Fit',
        pattern: 'Checked',
        occasion: 'Casual',
        collar: 'Spread Collar',
        country_of_origin: 'India',
        wash_care: 'Machine wash cold with like colors. Do not bleach. Tumble dry low.',
      },
      tags: ['checked', 'casual', 'shirt', p.color.toLowerCase()],
      video_url: null,
      coverImage: images[0]?.url || '',
      imageUrl: images[0]?.url || '',
      thumbnailUrl: images[0]?.url || '',
      created_at: isNew ? now : ((existingSnap.data()?.created_at as string) || now),
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

    if (isNew) inserted++;
    else updated++;
    console.log(`  ${isNew ? '+ added' : '~ updated'}  ${p.sku}  ${p.name}  (${p.color}, ${images.length} images)`);
  }

  await bulkWriter.close();

  console.log('\n=== FINAL REPORT ===');
  console.log(`Total products added:   ${inserted}`);
  console.log(`Total products updated: ${updated}`);
  console.log(`\n✔ ${CURATED_CHECKED_SHIRTS.length}/30 curated Checked Shirt products written with real photos.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
