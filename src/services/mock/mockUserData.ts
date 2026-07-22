import type {
  Address,
  CartItem,
  Coupon,
  Notification,
  Order,
  RecentlyViewedItem,
  ReturnRequest,
  SavedPaymentMethod,
  StylePreferences,
  WishlistItem,
} from '@/types';
import { readStore, writeStore } from './mockStorage';

const MAX_RECENTLY_VIEWED = 12;

function userKey(userId: string, entity: string): string {
  return `${entity}:${userId}`;
}

export function getCart(userId: string): CartItem[] {
  return readStore<CartItem[]>(userKey(userId, 'cart'), []);
}
export function saveCart(userId: string, items: CartItem[]): void {
  writeStore(userKey(userId, 'cart'), items);
}

export function getWishlist(userId: string): WishlistItem[] {
  return readStore<WishlistItem[]>(userKey(userId, 'wishlist'), []);
}
export function saveWishlist(userId: string, items: WishlistItem[]): void {
  writeStore(userKey(userId, 'wishlist'), items);
}

export function getRecentlyViewed(userId: string): RecentlyViewedItem[] {
  return readStore<RecentlyViewedItem[]>(userKey(userId, 'recently-viewed'), []);
}
export function saveRecentlyViewed(userId: string, items: RecentlyViewedItem[]): void {
  writeStore(userKey(userId, 'recently-viewed'), items);
}

/**
 * Folds a guest's cart/wishlist/recently-viewed into the account they just signed
 * into, so activity from before login isn't stranded under the old guest id.
 * Existing variant/product entries in the account take precedence over duplicates.
 */
export function mergeGuestDataIntoAccount(guestId: string, userId: string): void {
  if (guestId === userId) return;

  const guestCart = getCart(guestId);
  if (guestCart.length > 0) {
    const userCart = getCart(userId);
    const existingKeys = new Set(userCart.map((i) => `${i.product_id}:${i.variant_id}:${i.saved_for_later}`));
    const merged = [
      ...userCart,
      ...guestCart
        .filter((i) => !existingKeys.has(`${i.product_id}:${i.variant_id}:${i.saved_for_later}`))
        .map((i) => ({ ...i, id: `cart-${Date.now()}-${Math.random().toString(36).slice(2)}`, user_id: userId })),
    ];
    saveCart(userId, merged);
    saveCart(guestId, []);
  }

  const guestWishlist = getWishlist(guestId);
  if (guestWishlist.length > 0) {
    const userWishlist = getWishlist(userId);
    const existingProductIds = new Set(userWishlist.map((i) => i.product_id));
    const merged = [
      ...userWishlist,
      ...guestWishlist
        .filter((i) => !existingProductIds.has(i.product_id))
        .map((i) => ({ ...i, id: `wish-${Date.now()}-${Math.random().toString(36).slice(2)}`, user_id: userId })),
    ];
    saveWishlist(userId, merged);
    saveWishlist(guestId, []);
  }

  const guestRecentlyViewed = getRecentlyViewed(guestId);
  if (guestRecentlyViewed.length > 0) {
    const userRecentlyViewed = getRecentlyViewed(userId);
    const existingProductIds = new Set(userRecentlyViewed.map((i) => i.product_id));
    const merged = [
      ...userRecentlyViewed,
      ...guestRecentlyViewed
        .filter((i) => !existingProductIds.has(i.product_id))
        .map((i) => ({ ...i, id: `rv-${Date.now()}-${Math.random().toString(36).slice(2)}`, user_id: userId })),
    ]
      .sort((a, b) => new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime())
      .slice(0, MAX_RECENTLY_VIEWED);
    saveRecentlyViewed(userId, merged);
    saveRecentlyViewed(guestId, []);
  }
}

export function getAddresses(userId: string): Address[] {
  return readStore<Address[]>(userKey(userId, 'addresses'), []);
}
export function saveAddresses(userId: string, items: Address[]): void {
  writeStore(userKey(userId, 'addresses'), items);
}

export function getOrders(userId: string): Order[] {
  return readStore<Order[]>(userKey(userId, 'orders'), []);
}
export function saveOrders(userId: string, items: Order[]): void {
  writeStore(userKey(userId, 'orders'), items);
}

export function getNotifications(userId: string): Notification[] {
  return readStore<Notification[]>(userKey(userId, 'notifications'), []);
}
export function saveNotifications(userId: string, items: Notification[]): void {
  writeStore(userKey(userId, 'notifications'), items);
}

export function getReturns(userId: string): ReturnRequest[] {
  return readStore<ReturnRequest[]>(userKey(userId, 'returns'), []);
}
export function saveReturns(userId: string, items: ReturnRequest[]): void {
  writeStore(userKey(userId, 'returns'), items);
}

export function getSavedPayments(userId: string): SavedPaymentMethod[] {
  return readStore<SavedPaymentMethod[]>(userKey(userId, 'saved-payments'), []);
}
export function saveSavedPayments(userId: string, items: SavedPaymentMethod[]): void {
  writeStore(userKey(userId, 'saved-payments'), items);
}

const DEFAULT_COUPONS: Coupon[] = [
  {
    id: 'coupon-welcome10',
    code: 'WELCOME10',
    description: '10% off on your first order',
    discount_type: 'percent',
    discount_value: 10,
    min_order_value: 999,
    max_discount: 500,
    valid_from: new Date(Date.now() - 30 * 86400000).toISOString(),
    valid_until: new Date(Date.now() + 60 * 86400000).toISOString(),
    is_active: true,
    usage_limit: null,
    used_count: 128,
  },
  {
    id: 'coupon-flat200',
    code: 'FLAT200',
    description: 'Flat ₹200 off on orders above ₹1999',
    discount_type: 'flat',
    discount_value: 200,
    min_order_value: 1999,
    max_discount: null,
    valid_from: new Date(Date.now() - 30 * 86400000).toISOString(),
    valid_until: new Date(Date.now() + 45 * 86400000).toISOString(),
    is_active: true,
    usage_limit: 500,
    used_count: 340,
  },
  {
    id: 'coupon-mensfest25',
    code: 'MENSFEST25',
    description: '25% off on Men\'s Wear, up to ₹750',
    discount_type: 'percent',
    discount_value: 25,
    min_order_value: 1499,
    max_discount: 750,
    valid_from: new Date(Date.now() - 10 * 86400000).toISOString(),
    valid_until: new Date(Date.now() + 20 * 86400000).toISOString(),
    is_active: true,
    usage_limit: null,
    used_count: 890,
  },
  {
    id: 'coupon-kidscare15',
    code: 'KIDSCARE15',
    description: '15% off on Kids\' Wear',
    discount_type: 'percent',
    discount_value: 15,
    min_order_value: 799,
    max_discount: 400,
    valid_from: new Date(Date.now() - 10 * 86400000).toISOString(),
    valid_until: new Date(Date.now() + 30 * 86400000).toISOString(),
    is_active: true,
    usage_limit: null,
    used_count: 210,
  },
];

export function getCoupons(): Coupon[] {
  return readStore<Coupon[]>('coupons', DEFAULT_COUPONS);
}

export function addCoupon(coupon: Coupon): void {
  writeStore('coupons', [coupon, ...getCoupons()]);
}

export function upsertCoupon(coupon: Coupon): void {
  const coupons = getCoupons();
  const idx = coupons.findIndex((c) => c.id === coupon.id);
  if (idx >= 0) coupons[idx] = coupon;
  else coupons.unshift(coupon);
  writeStore('coupons', coupons);
}

export function removeCoupon(couponId: string): void {
  writeStore(
    'coupons',
    getCoupons().filter((c) => c.id !== couponId),
  );
}

export function getStylePreferences(userId: string): StylePreferences | null {
  return readStore<StylePreferences | null>(userKey(userId, 'style-preferences'), null);
}

export function saveStylePreferences(userId: string, input: Omit<StylePreferences, 'id' | 'user_id' | 'updated_at'>): StylePreferences {
  const preferences: StylePreferences = {
    id: `style-${userId}`,
    user_id: userId,
    ...input,
    updated_at: new Date().toISOString(),
  };
  writeStore(userKey(userId, 'style-preferences'), preferences);
  return preferences;
}
