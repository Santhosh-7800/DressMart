import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  query,
  setDoc,
  updateDoc,
  where,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { slugify, calculateDiscount } from '@/lib/utils';
import { inventoryService } from './inventoryService';
import type {
  Brand,
  Category,
  Gender,
  PaginatedResult,
  Product,
  ProductFacets,
  ProductFilters,
  ProductImage,
  ProductVariant,
} from '@/types';
import type { SellerProductInput } from '@/types/seller';

const PRODUCTS_COLLECTION = 'products';
const CATALOG_FETCH_LIMIT = 500; // safety valve on the bounded client-side-filtered fetch — see list() below.

// ---------------------------------------------------------------------------
// Reference-data caches (brands/categories) — small, mostly-static collections.
// Fetched once per page load and reused everywhere a product needs its brand/category joined in,
// since Firestore has no server-side join and re-fetching ~60 tiny docs on every product query
// would be wasteful. Call primeCatalogCaches() to force a refresh (e.g. after seeding).
// ---------------------------------------------------------------------------
let brandsPromise: Promise<Map<string, Brand>> | null = null;
let categoriesPromise: Promise<Map<string, Category>> | null = null;

async function getBrandsMap(): Promise<Map<string, Brand>> {
  if (!brandsPromise) {
    brandsPromise = getDocs(collection(db, 'brands')).then((snap) => new Map(snap.docs.map((d) => [d.id, d.data() as Brand])));
  }
  return brandsPromise;
}

async function getCategoriesMap(): Promise<Map<string, Category>> {
  if (!categoriesPromise) {
    categoriesPromise = getDocs(collection(db, 'categories')).then((snap) => new Map(snap.docs.map((d) => [d.id, d.data() as Category])));
  }
  return categoriesPromise;
}

/** Clears the brand/category caches — call after seeding or after a Head Seller edits either. */
export function primeCatalogCaches(): void {
  brandsPromise = null;
  categoriesPromise = null;
}

async function hydrate(products: Product[]): Promise<Product[]> {
  const [brands, categories] = await Promise.all([getBrandsMap(), getCategoriesMap()]);
  return products.map((p) => ({ ...p, brand: brands.get(p.brand_id), category: categories.get(p.category_id) }));
}

async function categoryIdsForSlugs(slugs: string[]): Promise<string[]> {
  const categories = await getCategoriesMap();
  const bySlug = new Map([...categories.values()].map((c) => [c.slug, c.id]));
  return slugs.map((s) => bySlug.get(s)).filter((id): id is string => Boolean(id));
}

/**
 * Fetches a bounded window of active products matching the "cheap" server-side-safe filters
 * (equality-only: is_active, gender, category_id 'in' — Firestore never needs a composite index
 * for equality/'in'-only queries, unlike combining them with orderBy on another field). Everything
 * else — brand/color/size/price/rating/discount/search/inStock, plus all sorting — happens in
 * memory below. Firestore has no server-side full-text search or arbitrary compound filtering
 * without a dedicated search service (Algolia/Typesense), which is out of scope for this pass; at
 * this catalog's scale (hundreds, not millions, of products) fetching a bounded active/gender
 * window and filtering client-side is fast and simple. Revisit if the catalog grows to the point
 * this window stops being "bounded".
 */
async function fetchActiveWindow(gender?: Gender, categorySlugs?: string[]): Promise<Product[]> {
  const constraints: QueryConstraint[] = [where('is_active', '==', true)];
  if (gender) constraints.push(where('gender', '==', gender));
  if (categorySlugs?.length) {
    const ids = await categoryIdsForSlugs(categorySlugs);
    if (ids.length === 0) return [];
    constraints.push(where('category_id', 'in', ids.slice(0, 30)));
  }
  constraints.push(fsLimit(CATALOG_FETCH_LIMIT));
  const snap = await getDocs(query(collection(db, PRODUCTS_COLLECTION), ...constraints));
  return hydrate(snap.docs.map((d) => d.data() as Product));
}

function matchesRemainingFilters(p: Product, filters: ProductFilters): boolean {
  if (filters.brandIds?.length && !filters.brandIds.includes(p.brand_id)) return false;
  if (filters.colors?.length && !p.variants.some((v) => filters.colors!.includes(v.color))) return false;
  if (filters.sizes?.length && !p.variants.some((v) => filters.sizes!.includes(v.size))) return false;
  if (filters.minPrice !== undefined && p.price < filters.minPrice) return false;
  if (filters.maxPrice !== undefined && p.price > filters.maxPrice) return false;
  if (filters.minRating !== undefined && p.rating < filters.minRating) return false;
  if (filters.minDiscount !== undefined && p.discount_percent < filters.minDiscount) return false;
  if (filters.search) {
    const q = filters.search.trim().toLowerCase();
    if (q) {
      const haystack = `${p.name} ${p.brand?.name ?? ''} ${p.tags.join(' ')}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
  }
  return true;
}

function sortProducts(items: Product[], sort: ProductFilters['sort']): Product[] {
  const sorted = [...items];
  switch (sort) {
    case 'price_low_high':
      return sorted.sort((a, b) => a.price - b.price);
    case 'price_high_low':
      return sorted.sort((a, b) => b.price - a.price);
    case 'newest':
      return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    case 'rating':
      return sorted.sort((a, b) => b.rating - a.rating);
    case 'discount':
      return sorted.sort((a, b) => b.discount_percent - a.discount_percent);
    default:
      return sorted.sort((a, b) => b.rating_count - a.rating_count); // popularity
  }
}

/**
 * Builds the variant list from the seller's size/color selections. When editing, `existingVariants`
 * lets an unchanged size+color combo keep its original variant id — so its inventory.variant_stock
 * entry (keyed by variant id) stays attached instead of orphaning on every edit. A genuinely new
 * combo still gets a fresh id with no stock until the seller adds some via the Inventory page.
 */
function buildVariantsFromInput(input: SellerProductInput, productId: string, existingVariants: ProductVariant[] = []): ProductVariant[] {
  const sizes = input.sizes.length > 0 ? input.sizes : ['One Size'];
  const colors = input.colors.length > 0 ? input.colors : [{ name: 'Default', hex: '#1a1a1a' }];
  const existingByCombo = new Map(existingVariants.map((v) => [`${v.color}::${v.size}`, v]));
  const variants: ProductVariant[] = [];
  colors.forEach((color, colorIdx) => {
    sizes.forEach((size, sizeIdx) => {
      const existing = existingByCombo.get(`${color.name}::${size}`);
      variants.push({
        id: existing?.id ?? `${productId}-v-${colorIdx}-${sizeIdx}`,
        size,
        color: color.name,
        color_hex: color.hex,
        sku: existing?.sku ?? `${input.sku}-${color.name.replace(/\s+/g, '').slice(0, 4).toUpperCase()}-${size.replace(/\s+/g, '')}`,
        price_override: existing?.price_override ?? null,
      });
    });
  });
  return variants;
}

/** Splits the seller's single stock_quantity evenly across every variant, remainder to the first few — kept simple per spec. */
function splitStockAcrossVariants(totalStock: number, variants: ProductVariant[]): Record<string, number> {
  const count = variants.length || 1;
  const base = Math.floor(totalStock / count);
  let remainder = totalStock - base * count;
  const stock: Record<string, number> = {};
  variants.forEach((v) => {
    stock[v.id] = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
  });
  return stock;
}

export const productService = {
  async list(filters: ProductFilters): Promise<PaginatedResult<Product>> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 24;

    let items = await fetchActiveWindow(filters.gender, filters.categorySlugs);
    items = items.filter((p) => matchesRemainingFilters(p, filters));

    if (filters.inStockOnly) {
      const invMap = await inventoryService.getInventoryBatch(items.map((p) => p.id));
      items = items.filter((p) => (invMap[p.id]?.total_stock ?? 0) > 0);
    }

    items = sortProducts(items, filters.sort);

    const total = items.length;
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);

    return { items: paged, total, page, pageSize, hasMore: start + pageSize < total };
  },

  async getBySlug(slug: string): Promise<Product | null> {
    const snap = await getDocs(query(collection(db, PRODUCTS_COLLECTION), where('slug', '==', slug), fsLimit(1)));
    if (snap.empty) return null;
    const [product] = await hydrate([snap.docs[0].data() as Product]);
    return product;
  },

  async getById(id: string): Promise<Product | null> {
    const snap = await getDoc(doc(db, PRODUCTS_COLLECTION, id));
    if (!snap.exists()) return null;
    const [product] = await hydrate([snap.data() as Product]);
    return product;
  },

  async getRelated(product: Product): Promise<Product[]> {
    const snap = await getDocs(
      query(collection(db, PRODUCTS_COLLECTION), where('is_active', '==', true), where('category_id', '==', product.category_id), fsLimit(9)),
    );
    const items = await hydrate(snap.docs.map((d) => d.data() as Product));
    return items.filter((p) => p.id !== product.id).slice(0, 8);
  },

  async getFrequentlyBoughtTogether(product: Product): Promise<Product[]> {
    const snap = await getDocs(
      query(collection(db, PRODUCTS_COLLECTION), where('is_active', '==', true), where('gender', '==', product.gender), fsLimit(12)),
    );
    const items = await hydrate(snap.docs.map((d) => d.data() as Product));
    return items.filter((p) => p.category_id !== product.category_id).slice(0, 3);
  },

  async getFacets(gender?: string, categorySlug?: string): Promise<ProductFacets> {
    const scoped = await fetchActiveWindow(gender as Gender | undefined, categorySlug ? [categorySlug] : undefined);

    const brandCounts = new Map<string, number>();
    const colorCounts = new Map<string, number>();
    const sizeCounts = new Map<string, number>();
    let min = Infinity;
    let max = 0;

    scoped.forEach((p) => {
      brandCounts.set(p.brand_id, (brandCounts.get(p.brand_id) ?? 0) + 1);
      p.variants.forEach((v) => {
        colorCounts.set(v.color, (colorCounts.get(v.color) ?? 0) + 1);
        sizeCounts.set(v.size, (sizeCounts.get(v.size) ?? 0) + 1);
      });
      min = Math.min(min, p.price);
      max = Math.max(max, p.price);
    });

    const brandsMap = await getBrandsMap();

    return {
      brands: [...brandCounts.entries()]
        .map(([value, count]) => ({ value, label: brandsMap.get(value)?.name ?? value, count }))
        .sort((a, b) => b.count - a.count),
      colors: [...colorCounts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
      sizes: [...sizeCounts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
      priceRange: scoped.length > 0 ? { min, max } : { min: 0, max: 0 },
    };
  },

  async getDealsOfTheDay(): Promise<Product[]> {
    const snap = await getDocs(
      query(collection(db, PRODUCTS_COLLECTION), where('is_active', '==', true), where('is_deal_of_day', '==', true), fsLimit(60)),
    );
    const items = await hydrate(snap.docs.map((d) => d.data() as Product));
    const now = Date.now();
    return items
      .filter((p) => !p.deal_ends_at || new Date(p.deal_ends_at).getTime() > now)
      .sort((a, b) => new Date(a.deal_ends_at ?? 0).getTime() - new Date(b.deal_ends_at ?? 0).getTime())
      .slice(0, 12);
  },

  /**
   * "Flash Sales" isn't a distinct concept in the new data model (no is_flash_sale/flash_sale_*
   * fields on Product — see types/database.ts) — reused here as an alias for Deal of the Day so
   * the existing Flash Sale UI (FlashSalesPage/FlashSaleProductCard) keeps working rather than
   * being torn out; countdown reuses deal_ends_at.
   */
  async getFlashSales(): Promise<Product[]> {
    return this.getDealsOfTheDay();
  },

  async getTrending(): Promise<Product[]> {
    const snap = await getDocs(query(collection(db, PRODUCTS_COLLECTION), where('is_active', '==', true), where('is_trending', '==', true), fsLimit(12)));
    return hydrate(snap.docs.map((d) => d.data() as Product));
  },

  async getNewArrivals(): Promise<Product[]> {
    const snap = await getDocs(
      query(collection(db, PRODUCTS_COLLECTION), where('is_active', '==', true), where('is_new_arrival', '==', true), fsLimit(60)),
    );
    const items = await hydrate(snap.docs.map((d) => d.data() as Product));
    return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 12);
  },

  async getTopRated(): Promise<Product[]> {
    const snap = await getDocs(query(collection(db, PRODUCTS_COLLECTION), where('is_active', '==', true), fsLimit(200)));
    const items = await hydrate(snap.docs.map((d) => d.data() as Product));
    return items.sort((a, b) => b.rating - a.rating).slice(0, 12);
  },

  async getBestSellers(): Promise<Product[]> {
    const snap = await getDocs(query(collection(db, PRODUCTS_COLLECTION), where('is_active', '==', true), where('is_bestseller', '==', true), fsLimit(12)));
    return hydrate(snap.docs.map((d) => d.data() as Product));
  },

  /** Groups a handful of categories into "collections" for the homepage strip — no dedicated collections concept in the data model. */
  async getFeaturedCollections(): Promise<{ title: string; slug: string; products: Product[] }[]> {
    const categories = await getCategoriesMap();
    const leafCategories = [...categories.values()].filter((c) => c.parent_id).slice(0, 4);
    return Promise.all(
      leafCategories.map(async (c) => {
        const snap = await getDocs(
          query(collection(db, PRODUCTS_COLLECTION), where('is_active', '==', true), where('category_id', '==', c.id), fsLimit(4)),
        );
        const products = await hydrate(snap.docs.map((d) => d.data() as Product));
        return { title: c.name, slug: c.slug, products };
      }),
    );
  },

  async getByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
    const { documentId } = await import('firebase/firestore');
    const results = await Promise.all(
      chunks.map(async (chunk) => {
        const snap = await getDocs(query(collection(db, PRODUCTS_COLLECTION), where(documentId(), 'in', chunk)));
        return snap.docs.map((d) => d.data() as Product);
      }),
    );
    const byId = new Map(results.flat().map((p) => [p.id, p] as const));
    return hydrate(ids.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p)));
  },

  /** Every product owned by one seller (active or not) — powers the Seller Dashboard's product list. */
  async getBySeller(sellerId: string): Promise<Product[]> {
    const snap = await getDocs(
      query(collection(db, PRODUCTS_COLLECTION), where('seller_id', '==', sellerId)),
    );
    const items = snap.docs.map((d) => d.data() as Product).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return hydrate(items);
  },

  /** Creates the product doc + its paired inventory doc together. seller_id/seller_name are always
   *  taken from the signed-in seller, never trusted from the form (see firestore.rules). */
  async create(sellerId: string, sellerName: string, input: SellerProductInput): Promise<Product> {
    const ref = doc(collection(db, PRODUCTS_COLLECTION));
    const variants = buildVariantsFromInput(input, ref.id);
    const now = new Date().toISOString();

    const product: Product = {
      id: ref.id,
      seller_id: sellerId,
      seller_name: sellerName,
      name: input.name,
      slug: slugify(`${input.name}-${ref.id.slice(0, 6)}`),
      brand_id: input.brand_id,
      category_id: input.category_id,
      gender: input.gender,
      description: input.description,
      sku: input.sku,
      mrp: input.mrp,
      price: input.price,
      discount_percent: calculateDiscount(input.mrp, input.price),
      gst_percent: input.gst_percent,
      rating: 0,
      rating_count: 0,
      is_active: input.is_active,
      is_bestseller: false,
      is_new_arrival: true,
      is_trending: false,
      is_deal_of_day: false,
      deal_ends_at: null,
      is_return_eligible: input.is_return_eligible,
      is_exchange_eligible: input.is_exchange_eligible,
      specifications: {
        material: input.material,
        fit: input.fit,
        wash_care: input.wash_care,
        country_of_origin: 'India',
      },
      tags: [...new Set([...input.colors.map((c) => c.name.toLowerCase()), ...input.sizes.map((s) => s.toLowerCase())])],
      video_url: null,
      created_at: now,
      updated_at: now,
      images: input.images.map((url, idx): ProductImage => ({ id: `${ref.id}-img-${idx}`, url, alt: input.name, color: null, sort_order: idx })),
      variants,
    };

    await setDoc(ref, product);
    await inventoryService.createInventory(ref.id, sellerId, splitStockAcrossVariants(input.stock_quantity, variants), input.low_stock_threshold);

    const [hydrated] = await hydrate([product]);
    return hydrated;
  },

  /**
   * Updates an existing product owned by the caller. Reuses variant ids for unchanged size/color
   * combos (see buildVariantsFromInput) so existing per-variant stock survives an edit. If the
   * seller entered a non-zero stock_quantity, that many units are split across brand-new variant
   * combos only (existing combos' stock is left untouched — use the Inventory page to adjust those).
   */
  async update(productId: string, sellerId: string, sellerName: string, input: SellerProductInput): Promise<Product> {
    const existing = await this.getById(productId);
    const variants = buildVariantsFromInput(input, productId, existing?.variants ?? []);
    const updates: Partial<Product> = {
      seller_id: sellerId,
      seller_name: sellerName,
      name: input.name,
      brand_id: input.brand_id,
      category_id: input.category_id,
      gender: input.gender,
      description: input.description,
      sku: input.sku,
      mrp: input.mrp,
      price: input.price,
      discount_percent: calculateDiscount(input.mrp, input.price),
      gst_percent: input.gst_percent,
      is_active: input.is_active,
      is_return_eligible: input.is_return_eligible,
      is_exchange_eligible: input.is_exchange_eligible,
      specifications: {
        material: input.material,
        fit: input.fit,
        wash_care: input.wash_care,
        country_of_origin: 'India',
      },
      tags: [...new Set([...input.colors.map((c) => c.name.toLowerCase()), ...input.sizes.map((s) => s.toLowerCase())])],
      updated_at: new Date().toISOString(),
      images: input.images.map((url, idx): ProductImage => ({ id: `${productId}-img-${idx}`, url, alt: input.name, color: null, sort_order: idx })),
      variants,
    };
    await updateDoc(doc(db, PRODUCTS_COLLECTION, productId), updates);

    if (input.stock_quantity > 0) {
      const existingVariantIds = new Set((existing?.variants ?? []).map((v) => v.id));
      const brandNewVariants = variants.filter((v) => !existingVariantIds.has(v.id));
      if (brandNewVariants.length > 0) {
        const inventory = await inventoryService.getInventory(productId);
        const additional = splitStockAcrossVariants(input.stock_quantity, brandNewVariants);
        const mergedStock = { ...(inventory?.variant_stock ?? {}), ...additional };
        await inventoryService.updateStock(productId, mergedStock, input.low_stock_threshold);
      }
    }

    const product = await this.getById(productId);
    if (!product) throw new Error('Product not found after update.');
    return product;
  },

  async setActive(productId: string, isActive: boolean): Promise<void> {
    await updateDoc(doc(db, PRODUCTS_COLLECTION, productId), { is_active: isActive, updated_at: new Date().toISOString() });
  },

  async remove(productId: string): Promise<void> {
    await deleteDoc(doc(db, PRODUCTS_COLLECTION, productId));
  },
};

export const categoryService = {
  async list(gender?: string): Promise<Category[]> {
    const categories = [...(await getCategoriesMap()).values()].sort((a, b) => a.sort_order - b.sort_order);
    return gender ? categories.filter((c) => c.gender === gender && c.parent_id) : categories;
  },
};

export const brandService = {
  async list(): Promise<Brand[]> {
    return [...(await getBrandsMap()).values()].sort((a, b) => a.name.localeCompare(b.name));
  },

  async featured(): Promise<Brand[]> {
    return (await this.list()).filter((b) => b.is_featured);
  },
};

// Reviews now live in their own dedicated services/reviewService.ts (see that file) — not this one.
