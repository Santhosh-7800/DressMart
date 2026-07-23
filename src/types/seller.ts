import type { Gender } from './database';

/** Shape the Seller Dashboard's product form works with — the seller who owns the product is
 *  inferred server-side from the signed-in user, never taken from the form. `id` is present
 *  only when editing an existing (own) product. */
export interface SellerProductInput {
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
  wash_care: string;
  sizes: string[];
  colors: { name: string; hex: string }[];
  stock_quantity: number;
  low_stock_threshold: number;
  images: string[];
  is_return_eligible: boolean;
  is_exchange_eligible: boolean;
  is_active: boolean;
}

export type BulkProductAction = 'publish' | 'hide' | 'delete';

export interface SellerApplicationInput {
  full_name: string;
  email: string;
  phone: string;
  store_name: string;
  gst_number: string;
}
