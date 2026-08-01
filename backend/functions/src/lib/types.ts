/**
 * Server-side mirror of `src/types/database.ts` (the client-side ground truth). `functions/` is a
 * separately deployed TypeScript package, so it can't import across the project boundary — keep
 * this file in sync by hand whenever the client-side schema changes.
 *
 * All timestamp-ish fields are ISO date strings (not Firestore Timestamps), matching the client
 * contracts exactly, so documents written here read back with the same shape client-side expects.
 */

export type Gender = 'men' | 'kids';
export type UserRole = 'buyer' | 'seller' | 'head_seller' | 'staff';
export type SellerStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type StaffStatus = 'active' | 'disabled';

export type StaffPermissionKey =
  | 'add_products'
  | 'edit_products'
  | 'delete_products'
  | 'manage_inventory'
  | 'upload_images'
  | 'process_orders'
  | 'update_order_status'
  | 'approve_returns'
  | 'reply_to_customers'
  | 'view_reports';

export interface StaffProfile {
  id: string;
  seller_id: string;
  employee_id: string | null;
  designation: string;
  department: string | null;
  status: StaffStatus;
  status_reason: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ShopAddress {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  landmark: string | null;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
  store_name?: string;
  gst_number?: string;
  seller_status?: SellerStatus;
  seller_applied_at?: string;
  seller_approved_at?: string | null;
  seller_status_reason?: string | null;
  seller_id?: string;
  staff_status?: StaffStatus;
  staff_status_reason?: string | null;
  fcm_tokens?: string[];
  shop_logo_url?: string | null;
  shop_banner_url?: string | null;
  pickup_address?: ShopAddress | null;
  return_address?: ShopAddress | null;
  bank_account_holder?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  shop_cod_available?: boolean;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  is_featured: boolean;
}

export type SizeLabel = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL' | string;

export interface ProductVariant {
  id: string;
  size: SizeLabel;
  color: string;
  color_hex: string;
  sku: string;
  price_override: number | null;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  color: string | null;
  sort_order: number;
}

export interface ProductSpecifications {
  material: string;
  fit: string;
  wash_care: string;
  pattern?: string;
  sleeve?: string;
  neck?: string;
  occasion?: string;
  country_of_origin: string;
}

export interface Product {
  id: string;
  seller_id: string;
  seller_name: string;
  name: string;
  slug: string;
  brand_id: string;
  category_id: string;
  gender: Gender;
  description: string;
  sku: string;
  mrp: number;
  price: number;
  discount_percent: number;
  gst_percent: number;
  rating: number;
  rating_count: number;
  is_active: boolean;
  is_bestseller: boolean;
  is_new_arrival: boolean;
  is_trending: boolean;
  is_deal_of_day: boolean;
  deal_ends_at: string | null;
  is_return_eligible: boolean;
  is_exchange_eligible: boolean;
  specifications: ProductSpecifications;
  tags: string[];
  video_url: string | null;
  imageUrl?: string;
  thumbnailUrl?: string;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  staff_id?: string | null;
  staff_name?: string | null;
  updated_by?: string | null;
  images: ProductImage[];
  variants: ProductVariant[];
}

export interface Inventory {
  product_id: string;
  seller_id: string;
  total_stock: number;
  variant_stock: Record<string, number>;
  low_stock_threshold: number;
  updated_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  landmark: string | null;
  type: 'home' | 'work' | 'other';
  is_default: boolean;
}

export type OrderStatus =
  | 'placed'
  | 'confirmed'
  | 'packed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export type PaymentMethod = 'razorpay' | 'cod';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface OrderTimelineEvent {
  status: OrderStatus;
  label: string;
  timestamp: string;
  note?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string;
  seller_id: string;
  product_name: string;
  product_image: string;
  product_slug: string;
  brand_name: string;
  size: string;
  color: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  is_return_eligible: boolean;
  is_exchange_eligible: boolean;
  return_status: 'none' | 'requested' | 'approved' | 'rejected' | 'refunded';
  exchange_status: 'none' | 'requested' | 'approved' | 'rejected' | 'exchanged';
}

export interface Order {
  id: string;
  order_number: string;
  group_id: string;
  buyer_id: string;
  seller_id: string;
  status: OrderStatus;
  items: OrderItem[];
  address: Address;
  subtotal: number;
  discount: number;
  shipping_fee: number;
  tax: number;
  total: number;
  coupon_code: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  timeline: OrderTimelineEvent[];
  estimated_delivery: string;
  placed_at: string;
  tracking_number?: string;
  courier_name?: string;
  courier_phone?: string;
}

export type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'pickup_scheduled' | 'received' | 'refunded';

export interface ReturnTimelineEvent {
  status: ReturnStatus;
  label: string;
  timestamp: string;
}

export interface ReturnRequest {
  id: string;
  order_id: string;
  order_item_id: string;
  buyer_id: string;
  seller_id: string;
  reason: string;
  comment: string | null;
  status: ReturnStatus;
  refund_amount: number;
  timeline: ReturnTimelineEvent[];
  created_at: string;
}

export type ExchangeStatus = 'requested' | 'approved' | 'rejected' | 'pickup_scheduled' | 'exchanged';

export interface ExchangeTimelineEvent {
  status: ExchangeStatus;
  label: string;
  timestamp: string;
}

export interface ExchangeRequest {
  id: string;
  order_id: string;
  order_item_id: string;
  buyer_id: string;
  seller_id: string;
  reason: string;
  comment: string | null;
  desired_variant_id: string;
  desired_size: string;
  desired_color: string;
  status: ExchangeStatus;
  timeline: ExchangeTimelineEvent[];
  created_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discount_type: 'percent' | 'flat';
  discount_value: number;
  min_order_value: number;
  max_discount: number | null;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  usage_limit: number | null;
  used_count: number;
}

export type NotificationType =
  | 'order'
  | 'payment'
  | 'delivery'
  | 'return'
  | 'exchange'
  | 'new_order'
  | 'cancelled_order'
  | 'low_stock'
  | 'seller_registration'
  | 'platform';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export interface SellerRequest {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  store_name: string;
  gst_number: string;
  status: SellerStatus;
  applied_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
}

/** Singleton doc (`platform_settings/config`). */
export interface PlatformSettings {
  id: string;
  store_name: string;
  support_email: string;
  support_phone: string;
  gst_number: string;
  shipping_charge: number;
  free_shipping_threshold: number;
  return_window_days: number;
  exchange_window_days: number;
  return_policy: string;
  privacy_policy: string;
  updated_at: string;
}
