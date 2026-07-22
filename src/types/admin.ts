import type { Gender, Profile } from './database';

/** Shape the admin Product Form works with — simpler than the relational Product/ProductVariant/ProductImage
 *  trio it ultimately produces. `id` is present only when editing an existing product. */
export interface AdminProductInput {
  id?: string;
  name: string;
  sku: string;
  brand_id: string;
  category_id: string;
  gender: Gender;
  description: string;
  price: number;
  mrp: number;
  gst_percent: number;
  material: string;
  fit: string;
  sleeve: string;
  collar: string;
  sizes: string[];
  colors: { name: string; hex: string }[];
  stock_quantity: number;
  low_stock_threshold: number;
  images: string[];
  /** Published (visible to customers) vs. hidden/draft. */
  is_active: boolean;
  is_featured: boolean;
  is_trending: boolean;
  is_bestseller: boolean;
  is_new_arrival: boolean;
}

export type BulkProductAction = 'publish' | 'hide' | 'delete';

/**
 * Shape the Staff Portal's product form works with — a deliberately narrower subset of
 * AdminProductInput. Staff cannot set the merchandising flags (is_featured/is_trending/etc.) that
 * only Admin controls; those default false in productBuilder.ts for every staff-created product.
 * `id` is present only when editing an existing (own) product.
 */
export interface StaffProductInput {
  id?: string;
  name: string;
  sku: string;
  brand_id: string;
  category_id: string;
  gender: Gender;
  description: string;
  price: number;
  mrp: number;
  material: string;
  /** Free-text "Specifications" field — stored on Product.specifications.other_specs. */
  specifications: string;
  sizes: string[];
  colors: { name: string; hex: string }[];
  stock_quantity: number;
  /** First entry is the Thumbnail — see the "Set as thumbnail" control in StaffProductFormPage. */
  images: string[];
  tags: string[];
  /** "Visibility" in the spec — staff's intended published state, only realized once Admin approves. */
  is_active: boolean;
}

/** Extra Staff Portal profile fields layered on top of the shared `profiles` row — see the `staff` table (migration 0019/0020/0021). */
export interface StaffDetails {
  id: string;
  employee_id: string;
  shop_name: string;
  department: string;
  phone: string;
  status: 'active' | 'inactive';
  /** Display-only preference — the interface is English-only for now; see StaffSettingsPage. */
  language: string;
  /** Gates whether Admin's product approve/reject actions create a notification for this staff member. */
  notifications_enabled: boolean;
  /** Staff Portal's own theme preference — separate from ThemeContext's localStorage value so it
   *  survives logging in on a different device/browser. See StaffLayout's theme-sync effect. */
  theme: 'light' | 'dark';
  /** Staff row creation time — the closest available proxy for "joining date" (profiles.created_at is the auth account's signup date, which may predate being made staff). */
  created_at: string;
}

export type StaffMember = Profile & {
  employee_id: string | null;
  shop_name: string | null;
  department: string | null;
  status: 'active' | 'inactive';
  /** The `staff` row's created_at (when they became staff) — a closer proxy for "Joining Date" than profiles.created_at (their original signup date). Null for non-staff rows. */
  joined_at: string | null;
};
