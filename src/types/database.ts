/**
 * Domain types mirroring the Supabase schema (see supabase/migrations/0001_init.sql).
 * Kept hand-written (not generated) so the app can run in mock mode before a
 * real Supabase project is connected.
 */

export type Gender = 'men' | 'kids';

export type UserRole = 'customer' | 'admin' | 'shop_owner' | 'staff';

/** Workflow state for products submitted by staff — see AdminStaffProductsPage. Admin-authored
 *  products are always 'approved' (they go live immediately, no review step). 'draft' is a staff
 *  product that hasn't been submitted for review yet — never visible to Admin's review queue. */
export type ApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  /** Unique, shareable code this user can give out to earn referral rewards. */
  referral_code: string;
  /** id of the profile whose referral_code was used at this user's signup, if any. */
  referred_by: string | null;
  created_at: string;
  updated_at: string;
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

export interface ProductVariant {
  id: string;
  product_id: string;
  size: SizeLabel;
  color: string;
  color_hex: string;
  sku: string;
  stock: number;
  price_override: number | null;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt: string;
  color: string | null;
  sort_order: number;
  is_video_thumbnail?: boolean;
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
  /** Free-text specs field on the Staff Portal's product form — optional, so nothing else that reads ProductSpecifications needs to change. */
  other_specs?: string;
}

export interface Product {
  id: string;
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
  /**
   * Legacy sort/filter fields — always 0 now. Real ratings are computed dynamically
   * by the reviews system (see RatingSummary, useRatingSummary) and are never stored
   * on the product itself; kept here only so existing sort-by-rating/filter code paths
   * still resolve (they now correctly treat every product as tied/unrated).
   */
  rating: number;
  rating_count: number;
  total_stock: number;
  /** Admin-set reorder threshold — total_stock at or below this counts as "low stock" in Inventory. */
  low_stock_threshold: number;
  /** GST rate applied at checkout, as a percentage (e.g. 5 for 5%). */
  gst_percent: number;
  is_active: boolean;
  is_featured: boolean;
  is_bestseller: boolean;
  is_new_arrival: boolean;
  is_trending: boolean;
  is_deal_of_day: boolean;
  deal_ends_at: string | null;
  is_flash_sale: boolean;
  flash_sale_ends_at: string | null;
  /** Total units allocated to the flash sale (separate from total_stock, which is the regular sellable stock). */
  flash_sale_total_stock: number | null;
  /** How many of flash_sale_total_stock have already been claimed — drives the limited-stock indicator. */
  flash_sale_claimed: number | null;
  specifications: ProductSpecifications;
  tags: string[];
  video_url: string | null;
  /**
   * Staff Portal provenance (Task: Staff Portal). Optional so every pre-existing product (seeded
   * catalog, anything created before this feature) is treated as `created_by: 'admin'` and
   * `approval_status: 'approved'` by default — see getActiveCatalog() and productBuilder.ts.
   */
  created_by?: 'admin' | 'staff';
  created_by_id?: string | null;
  /** Snapshotted at creation time — same reasoning as OrderItem's product_name/brand_name — so
   *  Admin's staff-product review UI still shows who submitted it even if that account is later renamed or removed. */
  created_by_name?: string | null;
  employee_id?: string | null;
  department?: string | null;
  /** The physical shop a staff-submitted product belongs to — null for admin-authored products. */
  shop_name?: string | null;
  /** Gates customer-facing visibility alongside is_active — only 'approved' staff products ever show in the store. */
  approval_status?: ApprovalStatus;
  updated_at?: string;
  /** Ordered image URLs forming a 360° drag-to-rotate turntable sequence. Absent when no spin set exists. */
  spin_frames?: string[];
  /**
   * Real product photography (app-layer, camelCase — maps to `image_url`/`thumbnail_url`/`gallery_images`
   * columns in Supabase). `imageUrl`/`thumbnailUrl` are equal to `galleryImages[0]` by convention.
   * Populated with the expected path even before the file exists — see src/lib/productImages.ts —
   * so uploading a real photo to that path "just works" with no further code changes.
   * `images: ProductImage[]` below is kept in sync with these for the existing gallery/360/lightbox UI.
   */
  imageUrl?: string;
  thumbnailUrl?: string;
  galleryImages?: string[];
  created_at: string;
  images: ProductImage[];
  variants: ProductVariant[];
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  /** Null if the linked order was later deleted; order_item_id is what enforces one-review-per-purchase. */
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

/** Always computed live from the reviews table (SQL view / mock equivalent) — never stored. */
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

/** One of the current user's delivered, not-yet-reviewed order items for a product — gates the "Write a Review" UI. */
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

export interface RecentlyViewedItem {
  id: string;
  user_id: string;
  product_id: string;
  viewed_at: string;
}

/**
 * A named folder for organizing wishlisted products (e.g. "Birthday Gifts").
 * This sits on top of the existing wishlist — a product must already be
 * wishlisted (via WishlistItem) before it can be filed into a collection.
 * `product_ids` tracks which wishlisted products live in this collection;
 * a product not present in any collection is considered "Unsorted".
 */
export interface WishlistCollection {
  id: string;
  user_id: string;
  name: string;
  /** Non-null once the collection has been shared; used to build a public share link. */
  share_slug: string | null;
  product_ids: string[];
  created_at: string;
  updated_at: string;
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

export type PaymentMethod = 'upi' | 'credit_card' | 'debit_card' | 'net_banking' | 'wallet' | 'cod';

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
  product_name: string;
  product_image: string;
  /** Snapshotted at purchase time (same reasoning as product_name/product_image) — keeps Buy Again / Write Review links working even if the product is later changed or removed. */
  product_slug: string;
  brand_name: string;
  size: string;
  color: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  return_status: 'none' | 'requested' | 'approved' | 'rejected' | 'refunded';
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
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
  timeline: OrderTimelineEvent[];
  estimated_delivery: string;
  placed_at: string;
  /** Optional — orders placed before tracking was introduced won't have these. */
  tracking_number?: string;
  courier_name?: string;
  courier_phone?: string;
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
  /** Set when this coupon was privately minted for one user (e.g. a referral reward) rather than part of the public catalog. */
  granted_to_user_id?: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'order' | 'offer' | 'system' | 'return' | 'product';
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export type ReturnStatus = 'requested' | 'approved' | 'pickup_scheduled' | 'received' | 'refunded' | 'rejected';

export interface ReturnTimelineEvent {
  status: ReturnStatus;
  label: string;
  timestamp: string;
}

export interface ReturnRequest {
  id: string;
  order_id: string;
  order_item_id: string;
  user_id: string;
  reason: string;
  comment: string | null;
  status: ReturnStatus;
  refund_amount: number;
  timeline: ReturnTimelineEvent[];
  created_at: string;
}

export interface SavedPaymentMethod {
  id: string;
  user_id: string;
  type: 'card' | 'upi';
  label: string;
  last4: string | null;
  upi_id: string | null;
  is_default: boolean;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  link: string;
  sort_order: number;
  is_active: boolean;
}

export interface StylePreferences {
  id: string;
  user_id: string;
  favorite_color: string;
  preferred_fit: string;
  budget_min: number;
  budget_max: number;
  occasion: string;
  favorite_brand_ids: string[];
  updated_at: string;
}

export interface RewardsWallet {
  id: string;
  user_id: string;
  points_balance: number;
  lifetime_points_earned: number;
  updated_at: string;
}

export type RewardsTransactionType = 'earned' | 'redeemed';

export interface RewardsTransaction {
  id: string;
  user_id: string;
  type: RewardsTransactionType;
  /** Positive for earned, negative for redeemed. */
  points: number;
  description: string;
  order_id: string | null;
  created_at: string;
}

export type ReferralStatus = 'pending' | 'completed' | 'rewarded';

/** One row per person referred by referrer_id — created at the referee's signup, advances as they order. */
export interface ReferralRecord {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  referred_name: string;
  referred_email: string;
  status: ReferralStatus;
  reward_coupon_code: string | null;
  created_at: string;
  completed_at: string | null;
}

/** Singleton store configuration, managed from the admin Settings page. */
export interface StoreSettings {
  id: string;
  store_name: string;
  store_address: string;
  phone: string;
  email: string;
  gst_number: string;
  logo_url: string | null;
  banner_url: string | null;
  shipping_charge: number;
  free_shipping_threshold: number;
  return_policy: string;
  privacy_policy: string;
  updated_at: string;
}
