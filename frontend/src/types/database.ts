/**
 * Domain types mirroring the Firestore schema (see firestore.rules and README's "Data Model" section).
 * Firestore is schemaless — these are the app-layer contracts every service module reads/writes against.
 */

export type Gender = 'men' | 'kids';

/** Head Seller is a single, designated seller account with extra platform-management powers — see
 *  lib/roles.ts. Staff are employees created by the Head Seller to help run its store under
 *  granular, individually-assignable permissions — see StaffPermissions below. */
export type UserRole = 'buyer' | 'seller' | 'head_seller' | 'staff';

export type SellerStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export type StaffStatus = 'active' | 'disabled';

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
  /** Present only when role is 'staff' — the Head Seller's uid this staff account was created
   *  under. Every product/order/inventory/return a staff member touches is scoped to this id
   *  (see lib/roles.ts's effectiveSellerId), never their own uid. */
  seller_id?: string;
  staff_status?: StaffStatus;
  /** Set when staff_status is 'disabled' — shown back to the staff member. */
  staff_status_reason?: string | null;
  /** Web Push (FCM) registration tokens for this user's browsers — appended via arrayUnion by useFcmToken, one entry per opted-in browser/device. */
  fcm_tokens?: string[];
  /** Shop branding/logistics — present only for seller/head_seller, same as store_name/gst_number. */
  shop_logo_url?: string | null;
  shop_banner_url?: string | null;
  pickup_address?: ShopAddress | null;
  return_address?: ShopAddress | null;
  /** Informational only — no payout automation exists in this app. */
  bank_account_holder?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  /** Shop-level COD default — distinct from the per-product Product.cod_available. */
  shop_cod_available?: boolean;
  /** Set on every successful sign-in (see authService.signIn) — powers the Seller Dashboard's "Last Login" display. */
  last_login_at?: string;
}

/** Embedded address shape for a seller's pickup/return address — deliberately not the same as the
 *  buyer-facing Address type (which carries id/user_id/type/is_default that make no sense embedded
 *  directly on Profile). */
export interface ShopAddress {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  landmark: string | null;
}

/** One togglable capability a Head Seller can grant a staff account — see `staff_permissions/{staffId}`. */
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

/** `staff_permissions/{staffId}` — one doc per staff account, every key defaulting to false until
 *  the Head Seller grants it. Read by both firestore.rules (gating writes) and the Staff Dashboard
 *  nav (hiding actions the staff member can't perform). */
export type StaffPermissions = Record<StaffPermissionKey, boolean> & {
  staff_id: string;
  updated_at: string;
};

/** `staff/{staffId}` — extended profile fields for a staff account, separate from the auth-linked
 *  `users/{staffId}` doc (which only carries what login/role-gating needs). */
export interface StaffProfile {
  id: string;
  /** The Head Seller's uid this staff account works under — same value as Profile.seller_id. */
  seller_id: string;
  employee_id: string | null;
  designation: string;
  department: string | null;
  status: StaffStatus;
  status_reason: string | null;
  /** uid of the Head Seller who created this account. */
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type StaffActivityAction =
  | 'login'
  | 'product_created'
  | 'product_updated'
  | 'product_deleted'
  | 'order_status_updated'
  | 'return_processed'
  | 'exchange_processed'
  | 'inventory_updated';

/** `staff_activity/{id}` — append-only audit log of staff-performed actions, powering both the
 *  Head Seller's Activity Logs view and each staff member's own "recent activity" list. */
export interface StaffActivity {
  id: string;
  seller_id: string;
  staff_id: string;
  staff_name: string;
  action: StaffActivityAction;
  target_type: 'product' | 'session' | 'order' | 'return' | 'exchange' | 'inventory' | null;
  target_id: string | null;
  target_label: string | null;
  created_at: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  is_featured: boolean;
}

/** Head-Seller-managed homepage banner carousel — `banners` collection. */
export interface Banner {
  id: string;
  image_url: string | null;
  title: string;
  subtitle: string | null;
  link: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
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
  fabric: string;
  fit: string;
  wash_care?: string;
  pattern?: string;
  sleeve?: string;
  collar?: string;
  occasion?: string;
  country_of_origin: string;
}

/**
 * Merchandising status a seller/Head Seller sets explicitly. `is_active` (below) is derived from
 * this — 'active' and 'out_of_stock' are both buyer-visible (an out-of-stock listing still shows,
 * just marked unavailable, same as any real storefront), 'draft' and 'hidden' are not — so every
 * existing `where('is_active', ...)` catalog query keeps working unchanged.
 */
export type ProductStatus = 'draft' | 'active' | 'out_of_stock' | 'hidden';

export function isActiveStatus(status: ProductStatus): boolean {
  return status === 'active' || status === 'out_of_stock';
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
  /** Free-text sub-category (e.g. "Polo Shirts" under "Shirts") — no dedicated taxonomy collection. */
  subcategory: string | null;
  gender: Gender;
  description: string;
  sku: string;
  mrp: number;
  price: number;
  discount_percent: number;
  /** GST rate applied at checkout, as a percentage (e.g. 5 for 5%). */
  gst_percent: number;
  /** Per-product Cash-on-Delivery availability toggle. */
  cod_available: boolean;
  rating: number;
  rating_count: number;
  status: ProductStatus;
  /** Derived from `status` (see isActiveStatus) — the field every buyer-facing catalog query filters on. */
  is_active: boolean;
  is_bestseller: boolean;
  is_new_arrival: boolean;
  is_trending: boolean;
  /** Head-Seller-only "Feature this product" toggle — surfaces it in featured placements. */
  is_featured: boolean;
  is_deal_of_day: boolean;
  deal_ends_at: string | null;
  /** Gates the Return/Exchange actions on an order item — some categories (e.g. innerwear) are never eligible. */
  is_return_eligible: boolean;
  is_exchange_eligible: boolean;
  specifications: ProductSpecifications;
  tags: string[];
  video_url: string | null;
  /** First image overall — denormalized for fast list rendering without needing the full `images` array. */
  coverImage: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  created_at: string;
  updated_at: string;
  /** uid of whoever actually created this doc — the signed-in seller/head-seller for a normal
   *  self-added product, or a staff member's own uid when added on the store's behalf. Distinct
   *  from `seller_id`, which is always the owning store and never changes to a staff account. */
  created_by?: string | null;
  /** Present only when a staff account (not the seller themselves) created/last touched this
   *  product — denormalized name alongside the id so history reads fine even if the staff account
   *  is later removed. */
  staff_id?: string | null;
  staff_name?: string | null;
  updated_by?: string | null;
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
  /** Absent on reviews written before this feature — optional rather than `| null` since existing
   *  Firestore docs were never backfilled with the field. */
  seller_reply?: { text: string; replied_at: string } | null;
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

/**
 * Lives at `users/{uid}/cart/{cartItemId}` (a subcollection, not top-level — cart only ever exists
 * for a signed-in user, so scoping it under their own user doc is both the natural model and makes
 * firestore.rules trivial: `uid() == userId`). Deliberately camelCase, unlike the rest of this file's
 * snake_case — matches the schema this collection was explicitly specified against. `price`/`image`
 * are snapshotted at add-time (what the buyer saw when they added it); `variantId` isn't in that
 * original field list but is kept alongside `size`/`color` since it's what stock/order-placement
 * checks actually key off — re-deriving it from size+color on every read would be strictly worse.
 */
export interface CartItem {
  id: string;
  productId: string;
  variantId: string;
  sellerId: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
  image: string;
  addedAt: string;
  savedForLater: boolean;
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

/**
 * `user_activity/{uid}` — a signed-in user's lightweight personalization signals, one doc per
 * user so it roams across devices/browsers. Guests keep using localStorage (see
 * lib/guestId.ts) — this collection only exists for authenticated uids, created lazily on first
 * write rather than at signup, since a brand-new account has nothing to record yet.
 */
export interface UserActivity {
  id: string;
  /** Most-recent-first, deduped by product, capped — see userActivityService.MAX_RECENTLY_VIEWED. */
  recently_viewed: { product_id: string; viewed_at: string }[];
  /** Most-recent-first, deduped by slug, capped — see userActivityService.MAX_CATEGORY_HISTORY. */
  category_history: string[];
  /** Most-recent-first, deduped by normalized_query (re-searching the same thing bumps searched_at
   *  instead of duplicating), capped — see userActivityService.MAX_RECENT_SEARCHES. Powers both the
   *  search bar's "recent searches" chips and the search-based signal in personalizedRecommender.ts. */
  recent_searches: SearchHistoryEntry[];
  updated_at: string;
}

export interface SearchHistoryEntry {
  query: string;
  normalized_query: string;
  searched_at: string;
  result_count: number;
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
  /** Percentage of paid-order revenue the platform keeps — 0 until the Head Seller sets it, so
   *  existing installs are unaffected. Drives the dashboard's Platform Earnings / Seller Earnings split. */
  commission_rate_percent: number;
  updated_at: string;
}

export type PayoutStatus = 'pending' | 'paid';

/** `payouts/{id}` — a manually-recorded payout from the platform to a seller for a given period.
 *  No payment gateway integration exists for payouts; the Head Seller records that a bank transfer
 *  happened and marks it paid, same spirit as the app's existing "informational only" bank fields. */
export interface Payout {
  id: string;
  seller_id: string;
  seller_name: string;
  amount: number;
  period_start: string;
  period_end: string;
  status: PayoutStatus;
  note: string | null;
  created_at: string;
  created_by: string;
  paid_at: string | null;
  paid_by: string | null;
}
