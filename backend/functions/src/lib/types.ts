/**
 * Server-side mirror of `src/types/database.ts` (the client-side ground truth). `functions/` is a
 * separately deployed TypeScript package, so it can't import across the project boundary — keep
 * this file in sync by hand whenever the client-side schema changes.
 *
 * All timestamp-ish fields are ISO date strings (not Firestore Timestamps), matching the client
 * contracts exactly, so documents written here read back with the same shape client-side expects.
 */

export type Gender = 'men' | 'kids';
export type UserRole = 'buyer' | 'admin' | 'staff';
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

export type StaffPermissions = Record<StaffPermissionKey, boolean> & {
  staff_id: string;
  updated_at: string;
};

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
  /** Dedup flags (Phase 12) — whether a low/out-of-stock alert has already been sent for the
   *  CURRENT dip. Reset to false once total_stock rises back above low_stock_threshold, so a
   *  future dip alerts again instead of alerting once ever. See lib/inventoryAlerts.ts. */
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
 *  inside the same transaction as the inventory update it records. Never updated or deleted. */
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
  /** Set exactly once, server-side only (onReturnStatusChange), when stock has been restored for
   *  this return — guards against restoring twice if the status is re-written or the trigger
   *  redelivers. Absent/false on every return created before this field existed. */
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
  /** Set exactly once, server-side only (onExchangeStatusChange), when stock has been swapped
   *  (old variant restored, new variant decremented) for this exchange — guards against doing it
   *  twice if the status is re-written or the trigger redelivers. */
  inventory_restored?: boolean;
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
  seller_reply?: { text: string; replied_at: string } | null;
  is_hidden?: boolean;
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
  updated_at?: string;
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
  applicable_categories?: string[] | null;
  per_user_limit?: number | null;
  new_customers_only?: boolean;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

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
 * `supportTickets/{ticketId}` — Phase 16. Deliberately created/replied-to via direct, rules-gated
 * client writes (like returns/exchanges), not a Cloud Function, since every ownership/eligibility
 * check it needs (own order, own ticket, not-closed) is a single-doc get() rules can already
 * express — unlike reviews (Phase 14), which needed an arbitrary duplicate-review QUERY no rule
 * can perform. This is what lets ticket creation/replies work today despite the project's Spark
 * billing plan blocking every Cloud Function; only the notification fan-out (onSupportTicketCreated/
 * onSupportMessageCreated triggers, same as every other notification in the app) needs Blaze.
 *
 * `user_name` is the one deliberate denormalization onto this doc (a display name, not the full
 * profile) — added specifically so the owner dashboard can search/display by customer name without
 * an extra read per ticket; every other field stays a reference (order_id/return_id/exchange_id)
 * rather than a copy, per the "don't duplicate customer profile information" instruction.
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
  /** Unread flag for the ADMIN's side of the conversation — true whenever the customer has
   *  sent something the owner hasn't opened the ticket to see yet. */
  admin_unread: boolean;
  /** Unread flag for the CUSTOMER's side — true whenever the owner has replied and the customer
   *  hasn't opened the ticket since. */
  customer_unread: boolean;
}

export type SupportMessageType = 'customer_message' | 'owner_reply' | 'internal_note';

/**
 * `supportTickets/{ticketId}/messages/{messageId}` — append-only (allow update, delete: if false
 * in firestore.rules), same audit-trail idiom as inventory_movements/coupon_usages. `internal_note`
 * messages must NEVER reach a customer: the customer-facing list query always applies
 * `where('message_type', 'in', ['customer_message', 'owner_reply'])` so a query that could ever
 * match an internal_note is never even sent — Firestore rejects an entire list query if ANY
 * matched document fails `allow read`, so filtering must happen in the query itself, not just the
 * rule (the rule's own `message_type != 'internal_note'` check is defense-in-depth for a
 * single-document get(), not what makes list queries safe).
 */
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

/** `faqs/{faqId}` — Admin-managed Help Center content (Phase 16), mirrors banners/categories'
 *  plain-Firestore-CRUD pattern exactly (public read, isHeadSeller() write, no Cloud Function
 *  needed). HelpCenterPage falls back to a hardcoded default set (lib/defaultFaqs.ts) only when
 *  this collection is completely empty, so a fresh install never shows a blank Help Center before
 *  the owner has added any content. */
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
