/**
 * Domain types mirroring the Firestore schema (see firestore.rules and README's "Data Model" section).
 * Firestore is schemaless — these are the app-layer contracts every service module reads/writes against.
 */

export type Gender = 'men' | 'kids';

/** Head Seller is a single, designated seller account with extra platform-management powers — see lib/roles.ts. */
export type UserRole = 'buyer' | 'seller' | 'head_seller';

export type SellerStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
  /** Present only when role is 'seller' or 'head_seller'. */
  store_name?: string;
  gst_number?: string;
  seller_status?: SellerStatus;
  seller_applied_at?: string;
  seller_approved_at?: string | null;
  /** Set when seller_status is 'suspended' or 'rejected' — shown back to the seller. */
  seller_status_reason?: string | null;
  /** Web Push (FCM) registration tokens for this user's browsers — appended via arrayUnion by useFcmToken, one entry per opted-in browser/device. */
  fcm_tokens?: string[];
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  is_featured: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  gender: Gender;
  parent_id: string | null;
  image_url: string | null;
  sort_order: number;
}

export type SizeLabel = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL' | string;

/** A sellable size/color combination. Stock lives separately in Inventory, not here. */
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
  /** Owning seller — every product belongs to exactly one seller. Immutable after creation. */
  seller_id: string;
  /** Snapshotted store name, so listings/order history read fine even if the seller renames their store later. */
  seller_name: string;
  name: string;
  slug: string;
  brand_id: string;
  brand?: Brand;
  category_id: string;
  category?: Category;
  gender: Gender;
  description: string;
  sku: string;
  mrp: number;
  price: number;
  discount_percent: number;
  /** GST rate applied at checkout, as a percentage (e.g. 5 for 5%). */
  gst_percent: number;
  rating: number;
  rating_count: number;
  is_active: boolean;
  is_bestseller: boolean;
  is_new_arrival: boolean;
  is_trending: boolean;
  is_deal_of_day: boolean;
  deal_ends_at: string | null;
  /** Gates the Return/Exchange actions on an order item — some categories (e.g. innerwear) are never eligible. */
  is_return_eligible: boolean;
  is_exchange_eligible: boolean;
  specifications: ProductSpecifications;
  tags: string[];
  video_url: string | null;
  imageUrl?: string;
  thumbnailUrl?: string;
  created_at: string;
  updated_at: string;
  images: ProductImage[];
  variants: ProductVariant[];
}

/**
 * Stock lives in its own `inventory/{productId}` doc, separate from the product document, so
 * high-frequency stock writes (every purchase/cancellation) never rewrite the much larger,
 * rarely-changing product document. The product page merges the two by product id on read.
 */
export interface Inventory {
  product_id: string;
  seller_id: string;
  /** Rollup convenience field — sum of all variant stocks, kept in sync by Cloud Functions. */
  total_stock: number;
  /** Per-variant stock, keyed by ProductVariant.id. */
  variant_stock: Record<string, number>;
  low_stock_threshold: number;
  updated_at: string;
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  order_id: string | null;
  order_item_id: string;
  user_name: string;
  user_avatar: string | null;
  rating: number;
  review_title: string | null;
  review_text: string | null;
  images: string[];
  is_verified_purchase: boolean;
  helpful_count: number;
  created_at: string;
  updated_at: string;
}

export interface RatingSummary {
  product_id: string;
  average_rating: number;
  total_reviews: number;
  rating_5: number;
  rating_4: number;
  rating_3: number;
  rating_2: number;
  rating_1: number;
}

export interface ReviewableOrderItem {
  order_item_id: string;
  order_id: string;
  order_number: string;
  product_id: string;
  size: string;
  color: string;
  delivered_at: string;
}

export interface SubmitReviewInput {
  product_id: string;
  user_id: string;
  order_id: string;
  order_item_id: string;
  rating: number;
  review_title?: string;
  review_text?: string;
  images?: string[];
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

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  saved_for_later: boolean;
  created_at: string;
  product?: Product;
  variant?: ProductVariant;
}

export interface WishlistItem {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
  product?: Product;
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

/**
 * One shipment scoped to a single seller. A buyer's cart spanning multiple sellers splits into
 * multiple Order docs at checkout, all sharing the same `group_id` and `order_number` (and the
 * same `razorpay_order_id`, since payment happens once for the whole cart) — this is what lets
 * "seller cannot view another seller's orders" hold as a plain Firestore query (`where seller_id == me`)
 * instead of filtering inside an array. Buyer-facing pages group by `order_number` for display.
 */
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

/** A prospective seller's application — reviewed by the Head Seller (approve/suspend). */
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

/** Singleton doc (`platform_settings/config`) — Head Seller's Platform Settings page. */
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
