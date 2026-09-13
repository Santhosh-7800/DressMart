import { collection, deleteDoc, doc, getDoc, getDocs, increment, limit, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Coupon } from '@/types';

const COUPONS_COLLECTION = 'coupons';

/**
 * Coupon docs are keyed by their (uppercased) code — `coupons/{CODE}` — not an auto-generated id.
 * This matches how the cart/checkout side already reads coupons (see CouponInput.tsx's
 * `getDoc(doc(db, 'coupons', code.toUpperCase()))`): a coupon code lookup is a single point read
 * by id instead of a `where('code','==',...)` query. Keep this convention if you touch this file.
 */
function couponRef(codeOrId: string) {
  return doc(db, COUPONS_COLLECTION, codeOrId.trim().toUpperCase());
}

function isCurrentlyValid(coupon: Coupon, now = new Date()): boolean {
  if (!coupon.is_active) return false;
  if (now < new Date(coupon.valid_from) || now > new Date(coupon.valid_until)) return false;
  if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) return false;
  return true;
}

/** Public, currently-usable coupons — for the buyer-facing CouponsPage. `coupons` is a public-read
 *  collection (see firestore.rules); is_active + date-range/usage-limit filtering happens here
 *  since Firestore can't express "now between two fields" server-side. */
export async function listActiveCoupons(): Promise<Coupon[]> {
  const snap = await getDocs(query(collection(db, COUPONS_COLLECTION), where('is_active', '==', true)));
  const coupons = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Coupon);
  const now = new Date();
  return coupons.filter((c) => isCurrentlyValid(c, now));
}

/** Every coupon regardless of active/expired state — for the Head Seller's Coupon Management UI. */
export async function listAllCoupons(): Promise<Coupon[]> {
  const snap = await getDocs(query(collection(db, COUPONS_COLLECTION), orderBy('valid_from', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Coupon);
}

export interface CartLineForCoupon {
  categoryId: string;
  lineSubtotal: number;
}

/**
 * Validates a coupon code against the actual cart contents and returns the discount to apply.
 * This is a PREVIEW only — the authoritative check (identical rules, plus the two usage counts
 * re-read fresh) always happens again server-side inside placeOrderInternal's transaction before
 * an order is created or a payment is charged; a stale/tampered client read here can never affect
 * the real charge. The single implementation here replaces what used to be two near-duplicate
 * copies of this same logic (this function, previously unused, and CouponInput.tsx's own inline
 * version) — kept in sync by hand with backend/functions/src/lib/orderPlacement.ts's
 * checkCouponEligibility/computeDiscount, which this mirrors.
 */
export async function validateCoupon(
  code: string,
  cartLines: CartLineForCoupon[],
  userId: string | null,
): Promise<{ coupon: Coupon; discountAmount: number } | { error: string }> {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) return { error: 'Enter a coupon code.' };

  const snap = await getDoc(couponRef(normalizedCode));
  if (!snap.exists()) return { error: 'Invalid coupon code.' };

  const coupon = { id: snap.id, ...snap.data() } as Coupon;
  const grandSubtotal = cartLines.reduce((sum, l) => sum + l.lineSubtotal, 0);
  const hasCategoryRestriction = Boolean(coupon.applicable_categories && coupon.applicable_categories.length > 0);
  const eligibleSubtotal = hasCategoryRestriction
    ? cartLines.filter((l) => coupon.applicable_categories!.includes(l.categoryId)).reduce((sum, l) => sum + l.lineSubtotal, 0)
    : grandSubtotal;

  if (!coupon.is_active) return { error: 'This coupon is no longer active.' };
  const now = new Date();
  if (now < new Date(coupon.valid_from)) return { error: 'This coupon is not active yet.' };
  if (now > new Date(coupon.valid_until)) return { error: 'This coupon has expired.' };
  if (grandSubtotal < coupon.min_order_value) {
    return { error: `Add items worth ₹${(coupon.min_order_value - grandSubtotal).toFixed(0)} more to use this coupon.` };
  }
  if (eligibleSubtotal <= 0) {
    return { error: 'This coupon is not applicable to the products in your cart.' };
  }
  if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) {
    return { error: 'This coupon has reached its usage limit.' };
  }

  if (userId) {
    if (coupon.new_customers_only) {
      const priorOrder = await getDocs(query(collection(db, 'orders'), where('buyer_id', '==', userId), limit(1)));
      if (!priorOrder.empty) return { error: 'This coupon is only valid for new customers.' };
    }
    if (coupon.per_user_limit != null) {
      const priorUsage = await getDocs(
        query(collection(db, 'coupon_usages'), where('coupon_id', '==', coupon.id), where('user_id', '==', userId)),
      );
      if (priorUsage.size >= coupon.per_user_limit) {
        return { error: "You've already used this coupon the maximum number of times." };
      }
    }
  }

  let discountAmount = coupon.discount_type === 'percent' ? (eligibleSubtotal * coupon.discount_value) / 100 : coupon.discount_value;
  if (coupon.max_discount != null) discountAmount = Math.min(discountAmount, coupon.max_discount);
  discountAmount = Math.min(discountAmount, eligibleSubtotal);

  return { coupon, discountAmount: Math.round(discountAmount) };
}

/** Called once a coupon-discounted order is actually placed — keeps `used_count` (and therefore the
 *  usage_limit check above) accurate. Atomic increment, safe under concurrent checkouts. */
export async function incrementCouponUsage(codeOrId: string): Promise<void> {
  await updateDoc(couponRef(codeOrId), { used_count: increment(1) });
}

// --- Admin-only writes (coupons rule: `allow write: if isAdmin()`) ---

export async function createCoupon(input: Omit<Coupon, 'id' | 'used_count'>): Promise<Coupon> {
  const normalizedCode = input.code.trim().toUpperCase();
  const payload = { ...input, code: normalizedCode, used_count: 0 };
  await setDoc(couponRef(normalizedCode), payload);
  return { id: normalizedCode, ...payload };
}

/** `couponId` is the coupon's current code (== its doc id). If `updates.code` differs, the coupon
 *  is moved to a new doc keyed by the new code (Firestore doc ids are immutable) — everything else
 *  is a plain field update on the existing doc. */
export async function updateCoupon(couponId: string, updates: Partial<Omit<Coupon, 'id'>>): Promise<void> {
  const newCode = updates.code?.trim().toUpperCase();
  if (newCode && newCode !== couponId.trim().toUpperCase()) {
    const oldRef = couponRef(couponId);
    const oldSnap = await getDoc(oldRef);
    if (!oldSnap.exists()) throw new Error('Coupon not found.');
    const merged = { ...(oldSnap.data() as Omit<Coupon, 'id'>), ...updates, code: newCode };
    await setDoc(couponRef(newCode), merged);
    await deleteDoc(oldRef);
    return;
  }
  await updateDoc(couponRef(couponId), updates);
}

export async function setCouponActive(couponId: string, isActive: boolean): Promise<void> {
  await updateDoc(couponRef(couponId), { is_active: isActive });
}

export async function deleteCoupon(couponId: string): Promise<void> {
  await deleteDoc(couponRef(couponId));
}
