import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { slugify } from '@/lib/utils';
import type { AdminProductInput, Brand, BulkProductAction, Category, Product, ProductImage, ProductVariant } from '@/types';
import * as mockAdminProducts from './mock/mockAdminProducts';
import { getCatalog } from './mock/mockCatalogWithOverrides';
import { brandService, categoryService } from './productService';
import { staffService } from './staffService';
import { notificationService } from './notificationService';

function buildVariantsAndImages(input: AdminProductInput, productId: string): { variants: ProductVariant[]; images: ProductImage[] } {
  const combinationCount = Math.max(1, input.sizes.length * input.colors.length);
  const perVariantStock = Math.max(0, Math.floor(input.stock_quantity / combinationCount));

  const variants: ProductVariant[] = [];
  input.colors.forEach((color) => {
    input.sizes.forEach((size) => {
      variants.push({
        id: crypto.randomUUID(),
        product_id: productId,
        size,
        color: color.name,
        color_hex: color.hex,
        sku: `${input.sku}-${slugify(color.name).toUpperCase()}-${size}`,
        stock: perVariantStock,
        price_override: null,
      });
    });
  });

  const images: ProductImage[] = input.images.map((url, idx) => ({
    id: crypto.randomUUID(),
    product_id: productId,
    url,
    alt: input.name,
    color: null,
    sort_order: idx,
  }));

  return { variants, images };
}

/** Provenance/approval fields — defaulted to the pre-Staff-Portal behavior (admin-authored,
 *  auto-approved) so every existing call site (admin's own save()) is unaffected. staffProductService
 *  passes its own metadata through this same param instead of duplicating variant/image assembly. */
export interface ProductMeta {
  createdBy: 'admin' | 'staff';
  createdById: string | null;
  createdByName: string | null;
  employeeId: string | null;
  department: string | null;
  shopName: string | null;
  approvalStatus: 'draft' | 'pending' | 'approved' | 'rejected';
}

const ADMIN_META: ProductMeta = {
  createdBy: 'admin',
  createdById: null,
  createdByName: null,
  employeeId: null,
  department: null,
  shopName: null,
  approvalStatus: 'approved',
};

export function buildProduct(
  input: AdminProductInput,
  id: string,
  slug: string,
  brands: Brand[],
  categories: Category[],
  createdAt: string,
  meta: ProductMeta = ADMIN_META,
  updatedAt: string = new Date().toISOString(),
): Product {
  const { variants, images } = buildVariantsAndImages(input, id);
  const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
  const brand = brands.find((b) => b.id === input.brand_id);
  const category = categories.find((c) => c.id === input.category_id);
  const discountPercent = input.mrp > 0 ? Math.round(((input.mrp - input.price) / input.mrp) * 100) : 0;

  return {
    id,
    name: input.name,
    slug,
    brand_id: input.brand_id,
    brand,
    category_id: input.category_id,
    category,
    gender: input.gender,
    description: input.description,
    sku: input.sku,
    mrp: input.mrp,
    price: input.price,
    discount_percent: Math.max(discountPercent, 0),
    rating: 0,
    rating_count: 0,
    total_stock: totalStock,
    low_stock_threshold: input.low_stock_threshold,
    gst_percent: input.gst_percent,
    is_active: input.is_active,
    is_featured: input.is_featured,
    is_bestseller: input.is_bestseller,
    is_new_arrival: input.is_new_arrival,
    is_trending: input.is_trending,
    is_deal_of_day: false,
    deal_ends_at: null,
    is_flash_sale: false,
    flash_sale_ends_at: null,
    flash_sale_total_stock: null,
    flash_sale_claimed: null,
    specifications: {
      material: input.material,
      fit: input.fit,
      wash_care: 'Machine wash cold with like colors. Do not bleach. Tumble dry low.',
      sleeve: input.sleeve || undefined,
      neck: input.collar || undefined,
      country_of_origin: 'India',
    },
    tags: [],
    video_url: null,
    imageUrl: images[0]?.url,
    thumbnailUrl: images[0]?.url,
    galleryImages: images.map((i) => i.url),
    created_at: createdAt,
    created_by: meta.createdBy,
    created_by_id: meta.createdById,
    created_by_name: meta.createdByName,
    employee_id: meta.employeeId,
    department: meta.department,
    shop_name: meta.shopName,
    approval_status: meta.approvalStatus,
    updated_at: updatedAt,
    images,
    variants,
  };
}

const PRODUCT_SELECT = '*, brand:brands(*), category:categories(*), images:product_images(*), variants:product_variants(*)';

/** Notifies the submitting staff member of Admin's approve/reject decision — opt-in via that
 *  staff member's own "notify me" preference (StaffSettingsPage), never sent if they've turned it
 *  off or if this product somehow has no known creator. */
async function notifyStaffOfDecision(staffId: string | null | undefined, productName: string, decision: 'approved' | 'rejected'): Promise<void> {
  if (!staffId) return;
  const details = await staffService.getDetails(staffId).catch(() => null);
  if (!details?.notifications_enabled) return;

  await notificationService.create(staffId, {
    title: decision === 'approved' ? 'Product approved' : 'Product rejected',
    message:
      decision === 'approved'
        ? `"${productName}" was approved by Admin and is now live in the store.`
        : `"${productName}" was rejected by Admin. Edit it and resubmit for approval.`,
    type: 'product',
    link: '/staff/products',
  });
}

export const adminProductService = {
  async getById(productId: string): Promise<Product | null> {
    if (env.useMockData) return getCatalog().products.find((p) => p.id === productId) ?? null;
    const { data, error } = await supabase.from('products').select(PRODUCT_SELECT).eq('id', productId).single();
    if (error) return null;
    return data as unknown as Product;
  },

  /** Unlike the customer-facing product list, this sees every product regardless of is_active — admin/shop_owner bypass that via RLS in live mode. */
  async list(search: string, page = 1, pageSize = 20): Promise<{ items: Product[]; total: number }> {
    if (env.useMockData) {
      const all = getCatalog().products;
      const q = search.trim().toLowerCase();
      const filtered = q ? all.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) : all;
      const sorted = [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const start = (page - 1) * pageSize;
      return { items: sorted.slice(start, start + pageSize), total: sorted.length };
    }

    let query = supabase.from('products').select(PRODUCT_SELECT, { count: 'exact' }).order('created_at', { ascending: false });
    if (search.trim()) query = query.or(`name.ilike.%${search.trim()}%,sku.ilike.%${search.trim()}%`);
    const start = (page - 1) * pageSize;
    const { data, error, count } = await query.range(start, start + pageSize - 1);
    if (error) throw new Error(error.message);
    return { items: (data ?? []) as unknown as Product[], total: count ?? 0 };
  },

  async save(input: AdminProductInput): Promise<Product> {
    const [brands, categories] = await Promise.all([brandService.list(), categoryService.list()]);
    const isNew = !input.id;
    // A bare UUID works as both a mock-store key and a real `products.id` (uuid column) value.
    const id = input.id ?? crypto.randomUUID();
    const existing = isNew ? null : getCatalog().products.find((p) => p.id === id);
    const slug = existing?.slug ?? slugify(`${input.name}-${id.slice(0, 8)}`);
    const createdAt = existing?.created_at ?? new Date().toISOString();
    // Saving through the admin form always results in an approved product — this is how Admin
    // "approves" a staff submission while editing it — but the original creator attribution
    // (created_by/created_by_id/shop_name) is preserved rather than reset to admin/null.
    const meta: ProductMeta = existing
      ? {
          createdBy: existing.created_by ?? 'admin',
          createdById: existing.created_by_id ?? null,
          createdByName: existing.created_by_name ?? null,
          employeeId: existing.employee_id ?? null,
          department: existing.department ?? null,
          shopName: existing.shop_name ?? null,
          approvalStatus: 'approved',
        }
      : ADMIN_META;

    const product = buildProduct(input, id, slug, brands, categories, createdAt, meta);

    if (env.useMockData) {
      mockAdminProducts.saveProductOverride(product);
      return product;
    }

    const { error: productError } = await supabase.from('products').upsert({
      id: product.id,
      name: product.name,
      slug: product.slug,
      brand_id: product.brand_id,
      category_id: product.category_id,
      gender: product.gender,
      description: product.description,
      sku: product.sku,
      mrp: product.mrp,
      price: product.price,
      discount_percent: product.discount_percent,
      total_stock: product.total_stock,
      low_stock_threshold: product.low_stock_threshold,
      gst_percent: product.gst_percent,
      is_active: product.is_active,
      is_featured: product.is_featured,
      is_bestseller: product.is_bestseller,
      is_new_arrival: product.is_new_arrival,
      is_trending: product.is_trending,
      specifications: product.specifications,
      image_url: product.imageUrl,
      thumbnail_url: product.thumbnailUrl,
      gallery_images: product.galleryImages,
      created_by: product.created_by,
      created_by_id: product.created_by_id,
      created_by_name: product.created_by_name,
      employee_id: product.employee_id,
      department: product.department,
      shop_name: product.shop_name,
      approval_status: product.approval_status,
      updated_at: product.updated_at,
    });
    if (productError) throw new Error(productError.message);

    // Full-form save — replace variants/images wholesale rather than diffing individual rows.
    await supabase.from('product_variants').delete().eq('product_id', product.id);
    await supabase.from('product_images').delete().eq('product_id', product.id);

    if (product.variants.length > 0) {
      const { error } = await supabase.from('product_variants').insert(product.variants);
      if (error) throw new Error(error.message);
    }
    if (product.images.length > 0) {
      const { error } = await supabase.from('product_images').insert(product.images);
      if (error) throw new Error(error.message);
    }

    return product;
  },

  async duplicate(product: Product): Promise<Product> {
    const input: AdminProductInput = {
      name: `${product.name} (Copy)`,
      sku: `${product.sku}-COPY`,
      brand_id: product.brand_id,
      category_id: product.category_id,
      gender: product.gender,
      description: product.description,
      price: product.price,
      mrp: product.mrp,
      gst_percent: product.gst_percent,
      material: product.specifications.material,
      fit: product.specifications.fit,
      sleeve: product.specifications.sleeve ?? '',
      collar: product.specifications.neck ?? '',
      sizes: [...new Set(product.variants.map((v) => v.size))],
      colors: [...new Map(product.variants.map((v) => [v.color, { name: v.color, hex: v.color_hex }])).values()],
      stock_quantity: product.total_stock,
      low_stock_threshold: product.low_stock_threshold,
      images: product.galleryImages ?? product.images.map((i) => i.url),
      is_active: false,
      is_featured: false,
      is_trending: product.is_trending,
      is_bestseller: product.is_bestseller,
      is_new_arrival: product.is_new_arrival,
    };
    return this.save(input);
  },

  async setActive(productId: string, isActive: boolean): Promise<void> {
    if (env.useMockData) {
      const product = getCatalog().products.find((p) => p.id === productId);
      if (!product) throw new Error('Product not found.');
      mockAdminProducts.saveProductOverride({ ...product, is_active: isActive });
      return;
    }
    const { error } = await supabase.from('products').update({ is_active: isActive }).eq('id', productId);
    if (error) throw new Error(error.message);
  },

  async remove(productId: string): Promise<void> {
    if (env.useMockData) {
      mockAdminProducts.deleteProductOverride(productId);
      return;
    }
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) throw new Error(error.message);
  },

  /** Every product a staff member has ever submitted, across every shop — for Admin's review queue. */
  async listStaffSubmissions(): Promise<Product[]> {
    // Drafts are private work-in-progress — they never enter Admin's review queue until staff
    // actually submits them (approval_status becomes 'pending').
    if (env.useMockData) return getCatalog().products.filter((p) => p.created_by === 'staff' && p.approval_status !== 'draft');
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('created_by', 'staff')
      .neq('approval_status', 'draft')
      .order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data as unknown as Product[];
  },

  /** Approve a staff submission — it becomes visible in the store (subject to its own is_active/visibility choice). */
  async approveStaffProduct(productId: string): Promise<void> {
    if (env.useMockData) {
      const product = getCatalog().products.find((p) => p.id === productId);
      if (!product) throw new Error('Product not found.');
      mockAdminProducts.saveProductOverride({ ...product, approval_status: 'approved', updated_at: new Date().toISOString() });
      await notifyStaffOfDecision(product.created_by_id, product.name, 'approved');
      return;
    }
    const { data: product } = await supabase.from('products').select('name, created_by_id').eq('id', productId).single();
    const { error } = await supabase.from('products').update({ approval_status: 'approved', updated_at: new Date().toISOString() }).eq('id', productId);
    if (error) throw new Error(error.message);
    await supabase.from('staff_products').update({ approval_status: 'approved' }).eq('product_id', productId);
    await notifyStaffOfDecision(product?.created_by_id ?? null, product?.name ?? 'your product', 'approved');
  },

  /** Reject a staff submission — stays hidden from the store regardless of its is_active value. */
  async rejectStaffProduct(productId: string): Promise<void> {
    if (env.useMockData) {
      const product = getCatalog().products.find((p) => p.id === productId);
      if (!product) throw new Error('Product not found.');
      mockAdminProducts.saveProductOverride({ ...product, approval_status: 'rejected', is_active: false, updated_at: new Date().toISOString() });
      await notifyStaffOfDecision(product.created_by_id, product.name, 'rejected');
      return;
    }
    const { data: product } = await supabase.from('products').select('name, created_by_id').eq('id', productId).single();
    const { error } = await supabase
      .from('products')
      .update({ approval_status: 'rejected', is_active: false, updated_at: new Date().toISOString() })
      .eq('id', productId);
    if (error) throw new Error(error.message);
    await supabase.from('staff_products').update({ approval_status: 'rejected' }).eq('product_id', productId);
    await notifyStaffOfDecision(product?.created_by_id ?? null, product?.name ?? 'your product', 'rejected');
  },

  async bulkAction(productIds: string[], action: BulkProductAction): Promise<void> {
    if (action === 'delete') {
      if (env.useMockData) return mockAdminProducts.bulkDeleteProducts(productIds);
      const { error } = await supabase.from('products').delete().in('id', productIds);
      if (error) throw new Error(error.message);
      return;
    }
    const isActive = action === 'publish';
    if (env.useMockData) {
      const catalog = getCatalog();
      productIds.forEach((id) => {
        const product = catalog.products.find((p) => p.id === id);
        if (product) mockAdminProducts.saveProductOverride({ ...product, is_active: isActive });
      });
      return;
    }
    const { error } = await supabase.from('products').update({ is_active: isActive }).in('id', productIds);
    if (error) throw new Error(error.message);
  },

  /** Bulk import from a simple CSV: name,sku,brand_id,category_id,gender,price,mrp,stock_quantity,material,fit */
  async bulkImport(rows: AdminProductInput[]): Promise<Product[]> {
    const results: Product[] = [];
    for (const row of rows) {
      results.push(await this.save(row));
    }
    return results;
  },
};
