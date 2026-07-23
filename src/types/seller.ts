import type { Gender, ProductStatus } from './database';

/**
 * One color the seller has added, with its own image gallery and its own per-size stock —
 * `sizeStock` is keyed by size label (e.g. `{ M: 20, L: 12, XL: 8 }`). A (color, size) pair with a
 * `sizeStock` entry becomes exactly one ProductVariant; the entry's value is that variant's stock.
 */
export interface SellerProductColorInput {
  name: string;
  hex: string;
  /** Uploaded image URLs scoped to this color — every color has its own gallery. */
  images: string[];
  sizeStock: Record<string, number>;
}

/** Shape the Seller Dashboard's product form works with — the seller who owns the product is
 *  inferred server-side from the signed-in user, never taken from the form. `id` is present
 *  only when editing an existing (own) product. */
export interface SellerProductInput {
  id?: string;
  name: string;
  /** Blank means "auto-generate" — see lib/utils.ts's generateSku(). */
  sku: string;
  brand_id: string;
  category_id: string;
  subcategory: string;
  gender: Gender;
  description: string;
  fabric: string;
  sleeve: string;
  fit: string;
  pattern: string;
  collar: string;
  occasion: string;
  price: number;
  mrp: number;
  gst_percent: number;
  cod_available: boolean;
  low_stock_threshold: number;
  colors: SellerProductColorInput[];
  is_return_eligible: boolean;
  is_exchange_eligible: boolean;
  status: ProductStatus;
}

export type BulkProductAction = 'publish' | 'hide' | 'delete';

export interface SellerApplicationInput {
  full_name: string;
  email: string;
  phone: string;
  store_name: string;
  gst_number: string;
}
