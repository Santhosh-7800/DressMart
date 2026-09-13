import type { Coupon } from '@/types';

interface OrderLineLike {
  price: number;
  quantity: number;
  product?: { price: number; gst_percent: number } | null;
  variant?: { price_override?: number | null } | null;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  tax: number;
  shippingFee: number;
  total: number;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Mirrors backend/functions/src/lib/orderPlacement.ts's pricing exactly: tax is computed PER LINE
 * from that product's own `gst_percent` on the pre-discount line subtotal (never a flat rate on
 * the post-discount total — the two previously diverged: Cart/Checkout/Payment each hardcoded a
 * flat 5% applied after subtracting the coupon, while the backend applies each product's real GST
 * rate before any discount). Coupon discount and the free-shipping threshold check follow the same
 * formulas the backend uses. This is a DISPLAY calculation only — the backend remains the sole
 * source of truth for what's actually charged/recorded; nothing here is ever sent back as a total.
 *
 * Known simplification: a cart spanning more than one seller is billed by the backend as separate
 * per-seller sub-orders, each checked against the free-shipping threshold independently (so two
 * sellers each just under the threshold could each incur shipping even if the combined cart total
 * clears it). This function computes one aggregate total instead, which is correct for the common
 * single-shop case and matches what this app has always shown pre-checkout.
 */
export function computeOrderTotals(items: OrderLineLike[], coupon: Coupon | null, shippingFeeFlat: number, freeShippingThreshold: number): OrderTotals {
  let subtotal = 0;
  let tax = 0;
  for (const item of items) {
    const unitPrice = item.variant?.price_override ?? item.product?.price ?? item.price;
    const lineSubtotal = round2(unitPrice * item.quantity);
    const lineTax = round2((lineSubtotal * (item.product?.gst_percent ?? 0)) / 100);
    subtotal = round2(subtotal + lineSubtotal);
    tax = round2(tax + lineTax);
  }

  let discount = 0;
  if (coupon) {
    discount = coupon.discount_type === 'percent' ? (subtotal * coupon.discount_value) / 100 : coupon.discount_value;
    if (coupon.max_discount != null) discount = Math.min(discount, coupon.max_discount);
    discount = round2(discount);
  }

  const shippingFee = subtotal === 0 || subtotal >= freeShippingThreshold ? 0 : shippingFeeFlat;
  const total = round2(subtotal - discount + shippingFee + tax);

  return { subtotal, discount, tax, shippingFee, total };
}
