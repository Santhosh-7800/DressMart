import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { slugify } from '@/lib/utils';
import type { AdminProductInput, ApprovalStatus, Product, StaffProductInput } from '@/types';
import { buildProduct, type ProductMeta } from './adminProductService';
import * as mockAdminProducts from './mock/mockAdminProducts';
import { getCatalog } from './mock/mockCatalogWithOverrides';
import { brandService, categoryService } from './productService';

const PRODUCT_SELECT = '*, brand:brands(*), category:categories(*), images:product_images(*), variants:product_variants(*)';

/** Everything about the signed-in staff member needed to stamp a product with provenance —
 *  gathered once by the caller (StaffProductFormPage) from useAuth() + staffService.getDetails(). */
export interface StaffContext {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  shopName: string;
}

/** Maps the Staff Portal's narrower form shape onto AdminProductInput — the merchandising flags
 *  (is_featured/is_trending/etc.) that only Admin controls default to false/neutral for every
 *  staff-created product; GST/fit/sleeve/collar/low-stock-threshold aren't in scope for staff either. */
function toAdminInput(input: StaffProductInput): AdminProductInput {
  return {
    id: input.id,
    name: input.name,
    sku: input.sku,
    brand_id: input.brand_id,
    category_id: input.category_id,
    gender: input.gender,
    description: input.description,
    price: input.price,
    mrp: input.mrp,
    gst_percent: 5,
    material: input.material,
    fit: '',
    sleeve: '',
    collar: '',
    sizes: input.sizes,
    colors: input.colors,
    stock_quantity: input.stock_quantity,
    low_stock_threshold: 5,
    images: input.images,
    is_active: input.is_active,
    is_featured: false,
    is_trending: false,
    is_bestseller: false,
    is_new_arrival: false,
  };
}

/** Once a product has been submitted at least once (pending/approved/rejected), any further edit
 *  always resubmits it for review — "draft" only exists pre-submission and is never re-enterable. */
function resolveTargetStatus(existing: Product | null, requested: 'draft' | 'pending'): ApprovalStatus {
  if (!existing || existing.approval_status === 'draft') return requested;
  return 'pending';
}

async function syncSubmissionRecord(staffId: string, productId: string, status: ApprovalStatus): Promise<void> {
  if (status === 'draft') return; // Drafts are never submissions — no staff_products row yet.
  const { data: existingRow } = await supabase.from('staff_products').select('id').eq('product_id', productId).maybeSingle();
  if (existingRow) {
    await supabase.from('staff_products').update({ approval_status: status }).eq('product_id', productId);
  } else {
    await supabase.from('staff_products').insert({ staff_id: staffId, product_id: productId, approval_status: status });
  }
}

export const staffProductService = {
  /** Every product this staff member has ever submitted — any approval status (including drafts),
   *  since their own dashboard/product list needs to show those too, unlike the customer catalog. */
  async list(staffId: string): Promise<Product[]> {
    if (env.useMockData) return getCatalog().products.filter((p) => p.created_by === 'staff' && p.created_by_id === staffId);
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('created_by_id', staffId)
      .order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data as unknown as Product[];
  },

  /** Returns null (rather than throwing) when the product doesn't exist or isn't this staff member's own —
   *  callers (StaffProductFormPage) treat null as "not found / not yours" and bounce back to the list. */
  async getOwnById(productId: string, staffId: string): Promise<Product | null> {
    const product = env.useMockData
      ? getCatalog().products.find((p) => p.id === productId)
      : await supabase
          .from('products')
          .select(PRODUCT_SELECT)
          .eq('id', productId)
          .single()
          .then(({ data }) => data as unknown as Product | null);
    if (!product || product.created_by !== 'staff' || product.created_by_id !== staffId) return null;
    return product;
  },

  async create(input: StaffProductInput, staff: StaffContext, requestedStatus: 'draft' | 'pending'): Promise<Product> {
    const [brands, categories] = await Promise.all([brandService.list(), categoryService.list()]);
    const id = crypto.randomUUID();
    const slug = slugify(`${input.name}-${id.slice(0, 8)}`);
    const now = new Date().toISOString();
    const meta: ProductMeta = {
      createdBy: 'staff',
      createdById: staff.id,
      createdByName: staff.name,
      employeeId: staff.employeeId,
      department: staff.department,
      shopName: staff.shopName,
      approvalStatus: requestedStatus,
    };

    const product = buildProduct(toAdminInput(input), id, slug, brands, categories, now, meta, now);
    product.specifications = { ...product.specifications, other_specs: input.specifications };
    product.tags = input.tags;

    if (env.useMockData) {
      mockAdminProducts.saveProductOverride(product);
      return product;
    }

    const { error: productError } = await supabase.from('products').insert({
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
      is_featured: false,
      is_bestseller: false,
      is_new_arrival: false,
      is_trending: false,
      specifications: product.specifications,
      tags: product.tags,
      image_url: product.imageUrl,
      thumbnail_url: product.thumbnailUrl,
      gallery_images: product.galleryImages,
      created_by: 'staff',
      created_by_id: staff.id,
      created_by_name: staff.name,
      employee_id: staff.employeeId,
      department: staff.department,
      shop_name: staff.shopName,
      approval_status: requestedStatus,
      updated_at: now,
    });
    if (productError) throw new Error(productError.message);

    if (product.variants.length > 0) {
      const { error } = await supabase.from('product_variants').insert(product.variants);
      if (error) throw new Error(error.message);
    }
    if (product.images.length > 0) {
      const { error } = await supabase.from('product_images').insert(product.images);
      if (error) throw new Error(error.message);
    }

    await syncSubmissionRecord(staff.id, product.id, requestedStatus);

    return product;
  },

  /**
   * Editing a draft keeps it a draft (or promotes it to pending, per requestedStatus). Editing
   * anything already submitted (pending/approved/rejected) always resubmits it as pending — see
   * resolveTargetStatus. Throws if this isn't the caller's own product.
   */
  async update(input: StaffProductInput, staff: StaffContext, requestedStatus: 'draft' | 'pending'): Promise<Product> {
    if (!input.id) throw new Error('Missing product id.');
    const existing = await this.getOwnById(input.id, staff.id);
    if (!existing) throw new Error('You can only edit your own products.');

    const targetStatus = resolveTargetStatus(existing, requestedStatus);
    const [brands, categories] = await Promise.all([brandService.list(), categoryService.list()]);
    const now = new Date().toISOString();
    const meta: ProductMeta = {
      createdBy: 'staff',
      createdById: staff.id,
      createdByName: staff.name,
      employeeId: staff.employeeId,
      department: staff.department,
      shopName: existing.shop_name ?? staff.shopName,
      approvalStatus: targetStatus,
    };
    const product = buildProduct(toAdminInput(input), existing.id, existing.slug, brands, categories, existing.created_at, meta, now);
    product.specifications = { ...product.specifications, other_specs: input.specifications };
    product.tags = input.tags;

    if (env.useMockData) {
      mockAdminProducts.saveProductOverride(product);
      return product;
    }

    const { error } = await supabase
      .from('products')
      .update({
        name: product.name,
        brand_id: product.brand_id,
        category_id: product.category_id,
        gender: product.gender,
        description: product.description,
        sku: product.sku,
        mrp: product.mrp,
        price: product.price,
        discount_percent: product.discount_percent,
        total_stock: product.total_stock,
        gst_percent: product.gst_percent,
        is_active: product.is_active,
        specifications: product.specifications,
        tags: product.tags,
        image_url: product.imageUrl,
        thumbnail_url: product.thumbnailUrl,
        gallery_images: product.galleryImages,
        approval_status: targetStatus,
        updated_at: now,
      })
      .eq('id', product.id)
      .eq('created_by_id', staff.id);
    if (error) throw new Error(error.message);

    await supabase.from('product_variants').delete().eq('product_id', product.id);
    await supabase.from('product_images').delete().eq('product_id', product.id);
    if (product.variants.length > 0) await supabase.from('product_variants').insert(product.variants);
    if (product.images.length > 0) await supabase.from('product_images').insert(product.images);
    await syncSubmissionRecord(staff.id, product.id, targetStatus);

    return product;
  },

  // Deliberately no `remove()` — staff can never delete a product (enforced structurally, not just
  // hidden in the UI: there is no delete path for the Staff Portal to call, mirroring the absence
  // of a "staff can delete" RLS policy in migration 0019). Likewise no `publish()`/`approve()` —
  // staff cannot publish directly or approve their own submissions; only Admin's
  // approveStaffProduct()/rejectStaffProduct() (adminProductService.ts) ever set approval_status
  // to 'approved'/'rejected'.
};
