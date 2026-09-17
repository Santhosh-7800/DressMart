/**
 * Domain types mirroring the Firestore schema (see firestore.rules and README's "Data Model" section).
 * Firestore is schemaless — these are the app-layer contracts every service module reads/writes against.
 */

export type Gender = 'men' | 'kids';

/** Admin is the single store-owner account — see lib/roles.ts. Staff are employees created by the
 *  Admin to help run the store under granular, individually-assignable permissions — see
 *  StaffPermissions below. */
export type UserRole = 'buyer' | 'admin' | 'staff';

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
  /** Present only when role is 'admin'. */
  store_name?: string;
  gst_number?: string;
  /** Present only when role is 'staff' — the Admin's uid this staff account was created under.
   *  Every product/order/inventory/return a staff member touches is scoped to this id (see
   *  lib/roles.ts's effectiveSellerId), never their own uid. */
  seller_id?: string;
  staff_status?: StaffStatus;
  /** Set when staff_status is 'disabled' — shown back to the staff member. */
  staff_status_reason?: string | null;
  /** Web Push (FCM) registration tokens for this user's browsers — appended via arrayUnion by useFcmToken, one entry per opted-in browser/device. */
  fcm_tokens?: string[];
  /** Shop branding/logistics — present only for the Admin, same as store_name/gst_number. */
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
  /** Set on every successful sign-in (see authService.signIn) — powers the Admin Dashboard's "Last Login" display. */
  last_login_at?: string;
}

/** Embedded address shape for the Admin's pickup/return address — deliberately not the same as the
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

/** One togglable capability the Admin can grant a staff account — see `staff_permissions/{staffId}`. */
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
 *  the Admin grants it. Read by both firestore.rules (gating writes) and the Staff Dashboard
 *  nav (hiding actions the staff member can't perform). */
export type StaffPermissions = Record<StaffPermissionKey, boolean> & {
  staff_id: string;
  updated_at: string;
};

/** `staff/{staffId}` — extended profile fields for a staff account, separate from the auth-linked
 *  `users/{staffId}` doc (which only carries what login/role-gating needs). */
export interface StaffProfile {
  id: string;
  /** The Admin's uid this staff account works under — same value as Profile.seller_id. */
  seller_id: string;
  employee_id: string | null;
  designation: string;
  department: string | null;
  status: StaffStatus;
  status_reason: string | null;
  /** uid of the Admin who created this account. */
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
 *  Admin's Activity Logs view and each staff member's own "recent activity" list. */
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

/** Admin-managed homepage banner carousel — `banners` collection. */
export interface Banner {
  id: string;
  image_url: string | null;
  title: string;
  subtitle: string | null;
  link: string;
  /** Button text on the banner (e.g. "Shop Now") — defaults to "Shop Now" when unset, since every
   *  banner created before this field existed already has a working `link` and just needs a label. */
  cta_label?: string | null;
  /** Both null = always shown while is_active (the pre-Phase-13 default, unchanged). When set,
   *  the banner is only included in the public `list()` read during [start_at, end_at] — evaluated
   *  against the reading device's clock (Firestore has no way to filter "now" server-side across
   *  two fields), same caveat the OWNER already accepts for coupon valid_from/valid_until previews. */
  start_at?: string | null;
  end_at?: string | null;
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
 * Merchandising status the Admin (or staff with edit_products) sets explicitly. `is_active`
 * (below) is derived from this — 'active' and 'out_of_stock' are both buyer-visible (an
 * out-of-stock listing still shows, just marked unavailable, same as any real storefront), 'draft'
 * and 'hidden' are not — so every existing `where('is_active', ...)` catalog query keeps working
 * unchanged.
 */
export type ProductStatus = 'draft' | 'active' | 'out_of_stock' | 'hidden';

export function isActiveStatus(status: ProductStatus): boolean {
  return status === 'active' || status === 'out_of_stock';
}

export interface Product {
  id: string;
  /** The Admin's uid — every product is owned by the single Admin account. Immutable after creation. */
  seller_id: string;
  /** Snapshotted store name, so listings/order history read fine even if the store is renamed later. */
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
  /** Admin-only "Feature this product" toggle — surfaces it in featured placements. */
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
  /** uid of whoever actually created this doc — the Admin for a normal self-added product, or a
   *  staff member's own uid when added on the store's behalf. Distinct from `seller_id`, which is
   *  always the owning store (the Admin's uid) and never changes to a staff account. */
  created_by?: string | null;
  /** Present only when a staff account (not the Admin themselves) created/last touched this
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
  /** Dedup flags (Phase 12) — whether a low/out-of-stock alert has already been sent for the
   *  CURRENT dip. Reset to false once total_stock rises back above low_stock_threshold, so a
   *  future dip alerts again instead of alerting once ever. */
  low_stock_alert_sent?: boolean;
  out_of_stock_alert_sent?: boolean;
}

export type InventoryMovementType =
  | 'sale'
  | 'cancellation'
  | 'return'
  | 'exchange_out'
  | 'exchange_in'
  | 'manual_increase'
  | 'manual_decrease'
  | 'initial_stock';

/** `inventory_movements/{movementId}` — an append-only audit trail of every stock change, written
 *  server-side inside the same transaction as the inventory update it records. Read-only to the
 *  client (see firestore.rules); never updated or deleted. */
export interface InventoryMovement {
  id: string;
  product_id: string;
  variant_id: string;
  sku: string;
  seller_id: string;
  previous_quantity: number;
  quantity_changed: number;
  new_quantity: number;
  movement_type: InventoryMovementType;
  reason: string | null;
  order_id: string | null;
  return_id: string | null;
  exchange_id: string | null;
  performed_by: string;
  /** 'system' for movements a Firestore trigger applies as a side effect (return/exchange stock
   *  restoration) rather than a direct action by the signed-in user named in performed_by. */
  performed_by_role: UserRole | 'system';
  created_at: string;
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
  /** Owner moderation (Phase 14) — hidden reviews stay in Firestore (for accountability/appeal) but
   *  are filtered out of every public-facing list. Absent/false = visible, same reasoning as
   *  seller_reply above for why this is optional rather than backfilled. */
  is_hidden?: boolean;
}

/** Stored server-side (see backend/functions/src/triggers/onReviewWritten.ts) at
 *  `product_rating_summaries/{productId}` — computed once per review write, read many times, so a
 *  product page never has to fetch every review just to show a star average. */
export interface RatingSummary {
  product_id: string;
  average_rating: number;
  total_reviews: number;
  rating_5: number;
  rating_4: number;
  rating_3: number;
  rating_2: number;
  rating_1: number;
  updated_at?: string;
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
  /** Denormalized from the variant at order-placement time (Phase 17) — enables the owner order
   *  dashboard's SKU search without a per-item product lookup. Optional because orders placed
   *  before this field existed don't have it. */
  sku?: string;
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
 * One shipment, always owned by the single Admin account (`seller_id`). Historically a buyer's
 * cart spanning multiple sellers would split into multiple Order docs sharing the same `group_id`
 * and `order_number` — that no longer happens under the single-admin model, but the shape is kept
 * as-is (a checkout still produces one Order per `group_id`/`order_number`, just always exactly
 * one now) rather than reshaping every order document and query that already keys off it.
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
  /** Set exactly once, server-side only, once stock has been restored for this return. */
  inventory_restored?: boolean;
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
  /** Set exactly once, server-side only, once stock has been swapped for this exchange. */
  inventory_restored?: boolean;
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
  /** Null/empty = applies platform-wide (the pre-Phase-13 default behavior, unchanged). When set,
   *  the discount applies only to the subtotal of cart lines whose product.category_id is in this
   *  list — min_order_value still checks against the FULL cart subtotal (a coupon's minimum-order
   *  gate is about how much the customer is spending overall, not just on eligible items). */
  applicable_categories?: string[] | null;
  /** How many times ONE customer may use this coupon, across separate checkouts. Null = unlimited
   *  (same customer may reuse it every order) — distinct from `usage_limit`, which caps GLOBAL uses. */
  per_user_limit?: number | null;
  /** Restricts this coupon to customers with zero prior orders (any status) at the time they check
   *  out — the simplest safe/privacy-conscious customer segment (Phase 13 Section 14): no purchase-
   *  history profiling beyond "have they ordered before," and nothing is exposed back to the client
   *  about WHY a coupon was rejected beyond a generic ineligibility message. */
  new_customers_only?: boolean;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** `coupon_usages/{id}` — one record per successful checkout that used a coupon. Written exclusively by
 *  the order-placement Cloud Function, inside the same transaction that creates the order(s) and
 *  increments the coupon's `used_count`, so a failed/aborted checkout never creates a usage record
 *  (Phase 13 Section 7's "do not count a coupon as used merely because a customer clicked Apply").
 *  This is what makes `per_user_limit` enforceable and is also the source for promotion analytics
 *  ("most-used coupon", "revenue from coupon orders") beyond the aggregate `used_count`. */
export interface CouponUsage {
  id: string;
  coupon_id: string;
  coupon_code: string;
  user_id: string;
  order_group_id: string;
  discount_amount: number;
  used_at: string;
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
  | 'out_of_stock'
  | 'platform'
  | 'promotion'
  | 'support';

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

export type SupportCategory = 'order' | 'payment' | 'delivery' | 'return' | 'exchange' | 'product' | 'coupon' | 'account' | 'other';
export type SupportTicketStatus = 'open' | 'in_progress' | 'waiting_for_customer' | 'resolved' | 'closed';
export type SupportTicketPriority = 'low' | 'normal' | 'high';

/**
 * `supportTickets/{ticketId}` (Phase 16) — created/replied-to via direct, rules-gated writes (see
 * services/supportService.ts), the same idiom returns/exchanges already use: every check a create
 * needs (own order, own ticket, ticket not closed) is a single-doc lookup, which firestore.rules can
 * express directly, so no Cloud Function round-trip is needed for the core flow to work even while
 * Cloud Functions themselves are blocked (Spark plan). `user_name` is a deliberate single-field
 * denormalization (not the full profile) so the owner dashboard can search/display by customer name
 * without an extra read per ticket.
 */
export interface SupportTicket {
  id: string;
  user_id: string;
  user_name: string;
  subject: string;
  category: SupportCategory;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  order_id: string | null;
  return_id: string | null;
  exchange_id: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  last_message_at: string;
  last_message_by: 'customer' | 'admin';
  last_message_preview: string;
  admin_unread: boolean;
  customer_unread: boolean;
}

export type SupportMessageType = 'customer_message' | 'owner_reply' | 'internal_note';

/** `supportTickets/{ticketId}/messages/{messageId}` — append-only. `internal_note` messages must
 *  never be fetched for a customer: always query with `where('message_type', 'in',
 *  ['customer_message', 'owner_reply'])` (see supportService.listMessages) rather than relying on
 *  the read rule alone — Firestore rejects an entire list query if any matched doc would fail
 *  `allow read`, so the filter has to be in the query, not just the rule. */
export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: 'customer' | 'admin';
  message_type: SupportMessageType;
  message: string;
  created_at: string;
}

/** `faqs/{faqId}` — Admin-managed Help Center content, plain public-read/admin-write
 *  Firestore CRUD (no Cloud Function), mirroring banners/categories exactly. HelpCenterPage falls
 *  back to lib/defaultFaqs.ts only when this collection is completely empty. */
export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: SupportCategory;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** `support_rate_limits/{userId}` — per-user ticket-creation cooldown. `last_ticket_at` is written
 *  with Firestore's `serverTimestamp()` sentinel (a native Timestamp, not the ISO strings used
 *  elsewhere in this file) specifically so firestore.rules can do `request.time > last_ticket_at +
 *  duration.value(2, 'm')` arithmetic and reject a backdated value via `request.resource.data.
 *  last_ticket_at == request.time` — see supportService.ts. Deliberately just a cooldown, not an
 *  "open ticket count" cap — a count would need the Admin's status-change actions to keep it
 *  in sync too, crossing a write-permission boundary (this doc is owner(userId)-write-only) for
 *  marginal extra abuse protection. The frontend never reads this doc back (a rules rejection is
 *  caught and shown as a friendly cooldown message), so its Timestamp value never needs to
 *  round-trip through application code. */
export interface SupportRateLimit {
  last_ticket_at: unknown;
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

/** Singleton doc (`platform_settings/config`) — Admin's Platform Settings page. */
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
  /** Percentage of paid-order revenue the platform keeps — 0 until the Admin sets it, so
   *  existing installs are unaffected. Drives the dashboard's Platform Earnings / Seller Earnings split. */
  commission_rate_percent: number;
  updated_at: string;
}

export type PayoutStatus = 'pending' | 'paid';

/** `payouts/{id}` — a manually-recorded payout for a given period. No payment gateway integration
 *  exists for payouts; the Admin records that a bank transfer happened and marks it paid, same
 *  spirit as the app's existing "informational only" bank fields. */
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
