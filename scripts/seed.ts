/**
 * DressMart seed script.
 *
 * Populates a real Supabase project with the full generated catalog (brands,
 * categories, ~1700 products with variants and images) plus starter coupons
 * and banners. Uses the exact same generator as the in-browser mock mode
 * (src/lib/catalogGenerator.ts), so what you see in mock mode is what gets
 * written to your database.
 *
 * Usage:
 *   1. Copy .env.example to .env and fill in SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 *   2. Run the SQL migrations in supabase/migrations/*.sql against your project first
 *   3. npm run seed
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { buildCatalog } from '../src/lib/catalogGenerator';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || SUPABASE_URL.includes('your-project-ref')) {
  console.error(
    '\n✖ Missing Supabase credentials.\n' +
      '  Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file before running the seed script.\n' +
      '  (SUPABASE_SERVICE_ROLE_KEY is only used server-side here — never expose it to the client.)\n',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/**
 * Converts a generated `/images/products/<gender>/<folder>/<file>` path into its public URL in the
 * "product-images" Storage bucket (preferred — see supabase/migrations/0004_storage.sql). Upload
 * your real photos to that bucket under the same <gender>/<folder>/<product-slug>-N.webp keys (or
 * just serve them from public/images/products/... instead and skip this — either path convention
 * works, see src/lib/productImages.ts).
 */
function toStorageUrl(localPath: string): string {
  const key = localPath.replace(/^\/images\/products\//, '');
  return supabase.storage.from('product-images').getPublicUrl(key).data.publicUrl;
}

async function chunkedInsert<T extends Record<string, unknown>>(table: string, rows: T[], chunkSize = 500) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).insert(chunk as never[]);
    if (error) {
      console.error(`✖ Failed inserting into ${table} (rows ${i}-${i + chunk.length}):`, error.message);
      process.exit(1);
    }
    console.log(`  ✓ ${table}: ${Math.min(i + chunkSize, rows.length)}/${rows.length}`);
  }
}

async function main() {
  console.log('DressMart — seeding Supabase project\n');
  const { brands, categories, products } = buildCatalog();

  console.log(`Generated ${brands.length} brands, ${categories.length} categories, ${products.length} products in memory.\n`);

  console.log('Seeding brands...');
  await chunkedInsert(
    'brands',
    brands.map((b) => ({ id: b.id, name: b.name, slug: b.slug, logo_url: b.logo_url, description: b.description, is_featured: b.is_featured })),
  );

  console.log('Seeding categories (parents first)...');
  const parents = categories.filter((c) => !c.parent_id);
  const children = categories.filter((c) => c.parent_id);
  await chunkedInsert('categories', parents.map((c) => ({ id: c.id, name: c.name, slug: c.slug, gender: c.gender, parent_id: c.parent_id, image_url: c.image_url, sort_order: c.sort_order })));
  await chunkedInsert('categories', children.map((c) => ({ id: c.id, name: c.name, slug: c.slug, gender: c.gender, parent_id: c.parent_id, image_url: c.image_url, sort_order: c.sort_order })));

  console.log('Seeding products...');
  await chunkedInsert(
    'products',
    products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      brand_id: p.brand_id,
      category_id: p.category_id,
      gender: p.gender,
      description: p.description,
      sku: p.sku,
      mrp: p.mrp,
      price: p.price,
      discount_percent: p.discount_percent,
      rating: p.rating,
      rating_count: p.rating_count,
      total_stock: p.total_stock,
      is_active: p.is_active,
      is_bestseller: p.is_bestseller,
      is_new_arrival: p.is_new_arrival,
      is_trending: p.is_trending,
      is_deal_of_day: p.is_deal_of_day,
      deal_ends_at: p.deal_ends_at,
      specifications: p.specifications,
      tags: p.tags,
      video_url: p.video_url,
      image_url: p.imageUrl ? toStorageUrl(p.imageUrl) : null,
      thumbnail_url: p.thumbnailUrl ? toStorageUrl(p.thumbnailUrl) : null,
      gallery_images: (p.galleryImages ?? []).map(toStorageUrl),
      created_at: p.created_at,
    })),
  );

  console.log('Seeding product variants...');
  await chunkedInsert(
    'product_variants',
    products.flatMap((p) => p.variants.map((v) => ({ id: v.id, product_id: v.product_id, size: v.size, color: v.color, color_hex: v.color_hex, sku: v.sku, stock: v.stock, price_override: v.price_override }))),
  );

  console.log('Seeding product images...');
  await chunkedInsert(
    'product_images',
    products.flatMap((p) => p.images.map((img) => ({ id: img.id, product_id: img.product_id, url: toStorageUrl(img.url), alt: img.alt, color: img.color, sort_order: img.sort_order }))),
  );

  console.log('Seeding starter coupons...');
  await chunkedInsert('coupons', [
    { code: 'WELCOME10', description: '10% off on your first order', discount_type: 'percent', discount_value: 10, min_order_value: 999, max_discount: 500, valid_from: new Date().toISOString(), valid_until: new Date(Date.now() + 90 * 86400000).toISOString(), is_active: true },
    { code: 'FLAT200', description: 'Flat ₹200 off on orders above ₹1999', discount_type: 'flat', discount_value: 200, min_order_value: 1999, valid_from: new Date().toISOString(), valid_until: new Date(Date.now() + 60 * 86400000).toISOString(), is_active: true, usage_limit: 500 },
    { code: 'MENSFEST25', description: "25% off on Men's Wear, up to ₹750", discount_type: 'percent', discount_value: 25, min_order_value: 1499, max_discount: 750, valid_from: new Date().toISOString(), valid_until: new Date(Date.now() + 30 * 86400000).toISOString(), is_active: true },
    { code: 'KIDSCARE15', description: "15% off on Kids' Wear", discount_type: 'percent', discount_value: 15, min_order_value: 799, max_discount: 400, valid_from: new Date().toISOString(), valid_until: new Date(Date.now() + 45 * 86400000).toISOString(), is_active: true },
  ]);

  console.log('Seeding home page banners...');
  await chunkedInsert('banners', [
    { title: 'Season Launch', subtitle: 'Fresh Formal Shirts starting at ₹799', image_url: '', link: '/men/formal-shirts', sort_order: 0, is_active: true },
    { title: 'Denim Fest', subtitle: 'Flat 30% off on Jeans & Cargo Pants', image_url: '', link: '/men/slim-jeans', sort_order: 1, is_active: true },
    { title: 'Kids Wonderland', subtitle: 'Playful styles for your little ones', image_url: '', link: '/kids', sort_order: 2, is_active: true },
    { title: 'Winter Edit', subtitle: 'Hoodies & Jackets up to 45% off', image_url: '', link: '/men/jackets', sort_order: 3, is_active: true },
  ]);

  console.log('\n✔ Seed complete. Your Supabase project now has the full DressMart catalog.');
  console.log('  Note: image_url/thumbnail_url/gallery_images point at the "product-images" storage bucket by convention —');
  console.log('  upload real photos there (see the comment above toStorageUrl) or to public/images/products/ for local dev.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
