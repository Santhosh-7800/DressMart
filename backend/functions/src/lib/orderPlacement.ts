/**
 * Shared order-placement transaction used by both `placeCodOrder` and `verifyAndPlaceOrder` —
 * the only difference between the two callables is how payment is established beforehand
 * (nothing vs. Razorpay signature verification); the cart -> orders logic is identical.
 */
import { randomUUID } from 'crypto';
import type { DocumentReference } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { db } from './admin';
import { createNotification } from './notifications';
import { computeStockAlert, sendStockAlert, type PendingAlert } from './inventoryAlerts';
import { recordMovement } from './inventoryMovements';
import type {
  Address,
  Brand,
  Coupon,
  Inventory,
  Order,
  OrderItem,
  OrderTimelineEvent,
  PaymentMethod,
  PaymentStatus,
  PlatformSettings,
  Product,
} from './types';

export interface CartLineInput {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface PlaceOrderArgs {
  uid: string;
  addressId: string;
  couponCode?: string;
  cart: CartLineInput[];
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  /** Client-generated, stable per checkout attempt (see PaymentPage) — guards against a double-
   *  clicked "Place Order" / a retried network request creating two orders for the same checkout.
   *  Optional only so any other future caller of placeOrderInternal isn't forced to supply one. */
  clientRequestId?: string;
}

export interface PlaceOrderResult {
  orderNumber: string;
  groupId: string;
}

// Matches the client's own fallback defaults in src/services/platformSettingsService.ts, used
// when platform_settings/config hasn't been created yet.
const DEFAULT_SHIPPING_FEE = 0;
const DEFAULT_FREE_SHIPPING_THRESHOLD = 999;
const ESTIMATED_DELIVERY_DAYS = 5;

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

interface EnrichedLine extends CartLineInput {
  product: Product;
  unitPrice: number;
  lineSubtotal: number;
  lineTax: number;
}

interface CartQuote {
  cartLines: CartLineInput[];
  productIds: string[];
  address: Address;
  products: Map<string, Product>;
  brandNames: Map<string, string>;
  bySeller: Map<string, EnrichedLine[]>;
  grandSubtotal: number;
  discountTotal: number;
  appliedCouponCode: string | null;
  couponRef: DocumentReference | null;
  shippingFeeFlat: number;
  freeShippingThreshold: number;
  /** Sum of every seller sub-order's total (subtotal - discount + shipping + tax) — this is the
   *  single number a customer is ever actually charged for a cart, computed identically whether
   *  it's being quoted (Razorpay order creation) or committed (placeOrderInternal's transaction). */
  grandTotal: number;
}

/** Every coupon business rule EXCEPT usage counts (global/per-user), which can only be checked
 *  correctly against fresh, in-transaction data — see validateCouponUsageInTransaction below. This
 *  half is safe to run against a plain (non-transactional) read for the pre-payment quote/UX. */
function checkCouponEligibility(coupon: Coupon, eligibleSubtotal: number, grandSubtotal: number, now: Date): string | null {
  if (!coupon.is_active) return 'This coupon is no longer active.';
  if (now < new Date(coupon.valid_from)) return 'This coupon is not active yet.';
  if (now > new Date(coupon.valid_until)) return 'This coupon has expired.';
  if (grandSubtotal < coupon.min_order_value) return 'Minimum order value not reached for this coupon.';
  if (eligibleSubtotal <= 0) return 'This coupon is not applicable to the products in your cart.';
  return null;
}

function computeDiscount(coupon: Coupon, eligibleSubtotal: number): number {
  let discount = coupon.discount_type === 'percent' ? (eligibleSubtotal * coupon.discount_value) / 100 : coupon.discount_value;
  if (coupon.max_discount != null) discount = Math.min(discount, coupon.max_discount);
  return round2(Math.min(discount, eligibleSubtotal));
}

/**
 * Server-authoritative cart pricing — the ONLY place cart totals are computed. Used both to quote
 * an amount for Razorpay order creation (getCartTotal, below) and, moments later, to actually
 * place the order (placeOrderInternal) — sharing this one implementation is what guarantees the
 * amount a customer is charged by Razorpay always matches the amount their order is recorded at,
 * rather than trusting a client-supplied figure for either step.
 */
async function computeCartQuote(args: {
  uid: string;
  addressId: string;
  couponCode?: string;
  cart: CartLineInput[];
}): Promise<CartQuote> {
  const { uid, addressId, couponCode, cart } = args;

  if (!addressId) {
    throw new HttpsError('invalid-argument', 'addressId is required.');
  }
  if (!Array.isArray(cart) || cart.length === 0) {
    throw new HttpsError('invalid-argument', 'Cart is empty.');
  }

  // Defensively aggregate duplicate (productId, variantId) lines so stock is only checked/decremented once per pair.
  const aggregated = new Map<string, CartLineInput>();
  for (const line of cart) {
    // Phase 20: added Number.isInteger — quantity is used directly in price arithmetic (unitPrice *
    // quantity) and inventory decrement math; a fractional value like 1.5 previously passed this
    // check (Number.isFinite alone doesn't reject it) and would have produced a fractional stock
    // decrement, unlike adjustStock.ts's delta, which already required an integer.
    if (!line?.productId || !line?.variantId || !Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new HttpsError('invalid-argument', 'Invalid cart line.');
    }
    const key = `${line.productId}::${line.variantId}`;
    const existing = aggregated.get(key);
    if (existing) {
      existing.quantity += line.quantity;
    } else {
      aggregated.set(key, { productId: line.productId, variantId: line.variantId, quantity: line.quantity });
    }
  }
  const cartLines = Array.from(aggregated.values());

  // 1. Address — must belong to this buyer.
  const addressSnap = await db.collection('addresses').doc(addressId).get();
  if (!addressSnap.exists) {
    throw new HttpsError('not-found', 'Address not found.');
  }
  const address = { id: addressSnap.id, ...(addressSnap.data() as Omit<Address, 'id'>) };
  if (address.user_id !== uid) {
    throw new HttpsError('permission-denied', 'This address does not belong to your account.');
  }

  // 2. Products + inventory — always read fresh from Firestore, never trust client-sent prices/stock.
  const productIds = Array.from(new Set(cartLines.map((l) => l.productId)));
  const [productSnaps, inventorySnaps] = await Promise.all([
    db.getAll(...productIds.map((id) => db.collection('products').doc(id))),
    db.getAll(...productIds.map((id) => db.collection('inventory').doc(id))),
  ]);

  const products = new Map<string, Product>();
  productSnaps.forEach((snap, i) => {
    if (!snap.exists) throw new HttpsError('not-found', `Product ${productIds[i]} not found.`);
    products.set(snap.id, { id: snap.id, ...(snap.data() as Omit<Product, 'id'>) });
  });

  const inventories = new Map<string, Inventory>();
  inventorySnaps.forEach((snap, i) => {
    if (!snap.exists) throw new HttpsError('not-found', `Inventory for product ${productIds[i]} not found.`);
    inventories.set(snap.id, snap.data() as Inventory);
  });

  for (const line of cartLines) {
    const product = products.get(line.productId)!;
    if (!product.is_active) {
      throw new HttpsError('failed-precondition', `"${product.name}" is no longer available.`);
    }
    // A cart line's variantId can go stale between "added to cart" and "checkout" — the seller
    // edited/removed that size-color combination, or (in local dev) the catalog was reseeded with
    // fresh variant ids. Without this check, the item-building step further down does a non-null
    // `.find(...)!` on this same lookup and throws a raw TypeError, which is exactly the kind of
    // unanticipated crash that used to surface to the customer as the bare "internal" error.
    if (!product.variants.some((v) => v.id === line.variantId)) {
      throw new HttpsError('failed-precondition', `"${product.name}" — the selected size/color is no longer available. Please remove it from your cart and re-add it.`);
    }
    const inventory = inventories.get(line.productId)!;
    const available = inventory.variant_stock[line.variantId] ?? 0;
    if (available < line.quantity) {
      throw new HttpsError('failed-precondition', `Insufficient stock for "${product.name}".`);
    }
  }

  // Brand names are denormalized onto each OrderItem; Product only stores brand_id.
  const brandIds = Array.from(new Set(Array.from(products.values()).map((p) => p.brand_id).filter(Boolean)));
  const brandSnaps = brandIds.length ? await db.getAll(...brandIds.map((id) => db.collection('brands').doc(id))) : [];
  const brandNames = new Map<string, string>();
  brandSnaps.forEach((snap, i) => {
    if (snap.exists) brandNames.set(brandIds[i], (snap.data() as Brand).name);
  });

  // 3. Group by seller, computing per-line pricing (server-authoritative).
  const bySeller = new Map<string, EnrichedLine[]>();
  let grandSubtotal = 0;
  for (const line of cartLines) {
    const product = products.get(line.productId)!;
    const variant = product.variants.find((v) => v.id === line.variantId);
    const unitPrice = variant?.price_override ?? product.price;
    const lineSubtotal = round2(unitPrice * line.quantity);
    const lineTax = round2((lineSubtotal * (product.gst_percent || 0)) / 100);
    grandSubtotal = round2(grandSubtotal + lineSubtotal);

    const enriched: EnrichedLine = { ...line, product, unitPrice, lineSubtotal, lineTax };
    const arr = bySeller.get(product.seller_id) ?? [];
    arr.push(enriched);
    bySeller.set(product.seller_id, arr);
  }

  // 4. Coupon (optional) — validated against the grand subtotal, then applied proportionally per seller-group.
  let discountTotal = 0;
  let appliedCouponCode: string | null = null;
  let couponRef: DocumentReference | null = null;
  if (couponCode) {
    // Coupons are keyed by their own (uppercased) code — a direct doc read, not a query. Normalized
    // here too (not just trusted from the client already having normalized it — see couponService.ts's
    // couponRef helper on the frontend, which this mirrors) so a raw/differently-cased code from any
    // future caller still resolves correctly instead of silently reporting "invalid coupon".
    const normalizedCode = couponCode.trim().toUpperCase();
    const couponDoc = await db.collection('coupons').doc(normalizedCode).get();
    if (!couponDoc.exists) {
      throw new HttpsError('failed-precondition', 'Invalid coupon code.');
    }
    const coupon = couponDoc.data() as Coupon;
    const now = new Date();

    const hasCategoryRestriction = Boolean(coupon.applicable_categories && coupon.applicable_categories.length > 0);
    const eligibleSubtotal = hasCategoryRestriction
      ? round2(
          Array.from(bySeller.values())
            .flat()
            .filter((l) => coupon.applicable_categories!.includes(l.product.category_id))
            .reduce((sum, l) => sum + l.lineSubtotal, 0),
        )
      : grandSubtotal;

    const eligibilityError = checkCouponEligibility(coupon, eligibleSubtotal, grandSubtotal, now);
    if (eligibilityError) {
      throw new HttpsError('failed-precondition', eligibilityError);
    }
    if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) {
      throw new HttpsError('failed-precondition', 'This coupon has reached its usage limit.');
    }
    if (coupon.new_customers_only) {
      const priorOrder = await db.collection('orders').where('buyer_id', '==', uid).limit(1).get();
      if (!priorOrder.empty) {
        throw new HttpsError('failed-precondition', 'This coupon is only valid for new customers.');
      }
    }
    if (coupon.per_user_limit != null) {
      const priorUsage = await db
        .collection('coupon_usages')
        .where('coupon_id', '==', couponDoc.id)
        .where('user_id', '==', uid)
        .get();
      if (priorUsage.size >= coupon.per_user_limit) {
        throw new HttpsError('failed-precondition', "You've already used this coupon the maximum number of times.");
      }
    }

    discountTotal = computeDiscount(coupon, eligibleSubtotal);
    appliedCouponCode = coupon.code;
    couponRef = couponDoc.ref;
  }

  // 5. Shipping config.
  const settingsSnap = await db.collection('platform_settings').doc('config').get();
  const settings = settingsSnap.exists ? (settingsSnap.data() as PlatformSettings) : null;
  const shippingFeeFlat = settings?.shipping_charge ?? DEFAULT_SHIPPING_FEE;
  const freeShippingThreshold = settings?.free_shipping_threshold ?? DEFAULT_FREE_SHIPPING_THRESHOLD;

  // Same per-seller-group formula the placeOrderInternal transaction uses when it writes each
  // Order doc's own `total` — summed here to get the one number Razorpay actually charges.
  let grandTotal = 0;
  for (const [, lines] of bySeller.entries()) {
    const sellerSubtotal = round2(lines.reduce((sum, l) => sum + l.lineSubtotal, 0));
    const sellerTax = round2(lines.reduce((sum, l) => sum + l.lineTax, 0));
    const sellerDiscount = appliedCouponCode ? round2(discountTotal * (sellerSubtotal / grandSubtotal)) : 0;
    const sellerShipping = sellerSubtotal >= freeShippingThreshold ? 0 : shippingFeeFlat;
    grandTotal = round2(grandTotal + round2(sellerSubtotal - sellerDiscount + sellerShipping + sellerTax));
  }

  return { cartLines, productIds, address, products, brandNames, bySeller, grandSubtotal, discountTotal, appliedCouponCode, couponRef, shippingFeeFlat, freeShippingThreshold, grandTotal };
}

/** The authoritative cart total (rupees) for a given buyer/address/coupon/cart — used by
 *  createRazorpayOrder so the amount charged is never taken from the client. */
export async function getCartTotal(args: { uid: string; addressId: string; couponCode?: string; cart: CartLineInput[] }): Promise<number> {
  const quote = await computeCartQuote(args);
  return quote.grandTotal;
}

export async function placeOrderInternal(args: PlaceOrderArgs): Promise<PlaceOrderResult> {
  const { uid, addressId, couponCode, cart, paymentMethod, paymentStatus, razorpayOrderId = null, razorpayPaymentId = null, clientRequestId } = args;

  // Idempotency fast path: a prior call with this exact clientRequestId already completed (a
  // double-clicked button, or the client retrying after a response was lost in transit) — return
  // its result instead of placing a second order. The authoritative guard is the transactional
  // check further down; this is just a cheap early-out for the overwhelmingly common case.
  const requestRef = clientRequestId ? db.collection('order_requests').doc(clientRequestId) : null;
  if (requestRef) {
    const existing = await requestRef.get();
    if (existing.exists) {
      const data = existing.data() as { orderNumber: string; groupId: string };
      return { orderNumber: data.orderNumber, groupId: data.groupId };
    }
  }

  // Second, independent idempotency guard keyed by the Razorpay payment id itself (Phase 17
  // hardening) — clientRequestId already covers the common "double-clicked Place Order" case, but
  // it's client-generated and optional, so nothing previously stopped a call that omits it (or
  // varies it across retries) from placing a second order against the SAME already-captured
  // payment. `payment_receipts/{razorpayPaymentId}` closes that gap the same way order_requests
  // does: a replay of the same payment by the same buyer returns the original order instead of
  // creating a new one; a replay under a DIFFERENT buyer_id (payment id reuse/forgery) is rejected
  // outright rather than silently honored. Firestore-admin-only (see firestore.rules) — no client
  // ever reads or writes this collection directly.
  const paymentReceiptRef = razorpayPaymentId ? db.collection('payment_receipts').doc(razorpayPaymentId) : null;
  if (paymentReceiptRef) {
    const existingReceipt = await paymentReceiptRef.get();
    if (existingReceipt.exists) {
      const data = existingReceipt.data() as { orderNumber: string; groupId: string; buyer_id: string };
      if (data.buyer_id !== uid) {
        throw new HttpsError('already-exists', 'This payment has already been used to place an order.');
      }
      return { orderNumber: data.orderNumber, groupId: data.groupId };
    }
  }

  const { cartLines, productIds, address, products, brandNames, bySeller, grandSubtotal, discountTotal, appliedCouponCode, couponRef, shippingFeeFlat, freeShippingThreshold } =
    await computeCartQuote({ uid, addressId, couponCode, cart });

  const groupId = db.collection('orders').doc().id;
  const orderNumber = `ORD${Date.now()}`;
  const nowIso = new Date().toISOString();
  const estimatedDelivery = new Date(Date.now() + ESTIMATED_DELIVERY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Cart docs to delete — the callable only receives product/variant ids, so resolve the actual
  // cart doc ids via query rather than assuming they match anything client-supplied. Cart lives at
  // users/{uid}/cart (see types/database.ts's CartItem — signed-in-only, camelCase fields). A Buy
  // Now purchase never touches the cart at all (its item isn't in cartLines' matching query
  // results since it was never added there), so this naturally only clears what was actually in
  // the persistent cart.
  const cartDocsToDelete: DocumentReference[] = [];
  for (const line of cartLines) {
    const q = await db
      .collection('users')
      .doc(uid)
      .collection('cart')
      .where('productId', '==', line.productId)
      .where('variantId', '==', line.variantId)
      .get();
    q.docs.forEach((d) => cartDocsToDelete.push(d.ref));
  }

  const sellerIds = Array.from(bySeller.keys());
  const orderRefsBySeller = new Map<string, DocumentReference>();
  sellerIds.forEach((sellerId) => orderRefsBySeller.set(sellerId, db.collection('orders').doc()));

  const pendingAlerts: PendingAlert[] = [];
  const createdOrders: { sellerId: string; orderId: string; total: number }[] = [];
  // Set inside the transaction if a concurrent call already committed this exact clientRequestId
  // between the fast-path check above and here — the closer of the idempotency race window.
  let replay: { orderNumber: string; groupId: string } | null = null;

  await db.runTransaction(async (tx) => {
    if (requestRef) {
      const requestSnap = await tx.get(requestRef);
      if (requestSnap.exists) {
        const data = requestSnap.data() as { orderNumber: string; groupId: string };
        replay = { orderNumber: data.orderNumber, groupId: data.groupId };
        return;
      }
    }

    // Authoritative re-check of the payment-id guard above — closes the same race window the
    // clientRequestId re-check does (two concurrent calls both passing the pre-transaction read).
    if (paymentReceiptRef) {
      const receiptSnap = await tx.get(paymentReceiptRef);
      if (receiptSnap.exists) {
        const data = receiptSnap.data() as { orderNumber: string; groupId: string; buyer_id: string };
        if (data.buyer_id !== uid) {
          throw new HttpsError('already-exists', 'This payment has already been used to place an order.');
        }
        replay = { orderNumber: data.orderNumber, groupId: data.groupId };
        return;
      }
    }

    // Re-validate the coupon INSIDE the transaction, exactly like inventory below — the earlier
    // (pre-transaction) check in computeCartQuote can't protect against two concurrent checkouts
    // both reading the coupon in its last-remaining-use state and both passing. Only the checks
    // that can actually change between quote and commit (milliseconds apart, same request) are
    // repeated here: is_active/date-range (the owner could deactivate it mid-request) and the two
    // usage counts (the real race — see FieldValue.increment below). Cart contents/prices/category-
    // eligibility/min-order were already verified moments ago by the same computeCartQuote call
    // that produced discountTotal, so there's nothing new to recompute for those.
    if (couponRef) {
      const freshCouponSnap = await tx.get(couponRef);
      if (!freshCouponSnap.exists) {
        throw new HttpsError('failed-precondition', 'This coupon is no longer available.');
      }
      const freshCoupon = freshCouponSnap.data() as Coupon;
      const now = new Date();
      if (!freshCoupon.is_active || now < new Date(freshCoupon.valid_from) || now > new Date(freshCoupon.valid_until)) {
        throw new HttpsError('failed-precondition', 'This coupon is no longer valid. Please remove it and try again.');
      }
      if (freshCoupon.usage_limit != null && freshCoupon.used_count >= freshCoupon.usage_limit) {
        throw new HttpsError('failed-precondition', 'This coupon has just reached its usage limit. Please remove it and try again.');
      }
      if (freshCoupon.per_user_limit != null) {
        const priorUsageSnap = await tx.get(
          db.collection('coupon_usages').where('coupon_id', '==', couponRef.id).where('user_id', '==', uid),
        );
        if (priorUsageSnap.size >= freshCoupon.per_user_limit) {
          throw new HttpsError('failed-precondition', "You've already used this coupon the maximum number of times.");
        }
      }
    }

    // Re-read inventory INSIDE the transaction so concurrent purchases can't both pass the
    // earlier (pre-transaction) stock check and both decrement past zero.
    const invRefs = productIds.map((id) => db.collection('inventory').doc(id));
    const freshInvSnaps = await Promise.all(invRefs.map((ref) => tx.get(ref)));
    const freshInventory = new Map<string, Inventory>();
    freshInvSnaps.forEach((snap, i) => {
      if (!snap.exists) throw new HttpsError('not-found', `Inventory for product ${productIds[i]} not found.`);
      freshInventory.set(productIds[i], snap.data() as Inventory);
    });

    const qtyByProduct = new Map<string, Map<string, number>>();
    for (const line of cartLines) {
      const m = qtyByProduct.get(line.productId) ?? new Map<string, number>();
      m.set(line.variantId, (m.get(line.variantId) ?? 0) + line.quantity);
      qtyByProduct.set(line.productId, m);
    }

    for (const productId of productIds) {
      const inv = freshInventory.get(productId)!;
      const product = products.get(productId)!;
      const variantQtys = qtyByProduct.get(productId)!;
      const newVariantStock: Record<string, number> = { ...inv.variant_stock };
      const orderId = orderRefsBySeller.get(product.seller_id)!.id;
      let totalDelta = 0;
      for (const [variantId, qty] of variantQtys.entries()) {
        const previousQuantity = newVariantStock[variantId] ?? 0;
        if (previousQuantity < qty) {
          throw new HttpsError(
            'failed-precondition',
            `Insufficient stock for "${product.name}".`,
          );
        }
        const newQuantity = previousQuantity - qty;
        newVariantStock[variantId] = newQuantity;
        totalDelta += qty;

        recordMovement(
          tx,
          {
            productId,
            variantId,
            sku: product.variants.find((v) => v.id === variantId)?.sku ?? variantId,
            sellerId: inv.seller_id,
            previousQuantity,
            quantityChanged: -qty,
            newQuantity,
            movementType: 'sale',
            orderId,
            performedBy: uid,
            performedByRole: 'buyer',
          },
          nowIso,
        );
      }
      const newTotalStock = Math.max(0, inv.total_stock - totalDelta);

      const { flags, alert } = computeStockAlert(inv, newTotalStock, inv.low_stock_threshold, {
        sellerId: inv.seller_id,
        productId,
        productName: product.name,
      });
      pendingAlerts.push(alert);

      tx.update(db.collection('inventory').doc(productId), {
        variant_stock: newVariantStock,
        total_stock: newTotalStock,
        updated_at: nowIso,
        low_stock_alert_sent: flags.low_stock_alert_sent,
        out_of_stock_alert_sent: flags.out_of_stock_alert_sent,
      });
    }

    for (const [sellerId, lines] of bySeller.entries()) {
      const sellerSubtotal = round2(lines.reduce((sum, l) => sum + l.lineSubtotal, 0));
      const sellerTax = round2(lines.reduce((sum, l) => sum + l.lineTax, 0));
      const sellerDiscount = appliedCouponCode ? round2(discountTotal * (sellerSubtotal / grandSubtotal)) : 0;
      const sellerShipping = sellerSubtotal >= freeShippingThreshold ? 0 : shippingFeeFlat;
      const sellerTotal = round2(sellerSubtotal - sellerDiscount + sellerShipping + sellerTax);

      const orderRef = orderRefsBySeller.get(sellerId)!;

      const items: OrderItem[] = lines.map((l) => {
        const variant = l.product.variants.find((v) => v.id === l.variantId)!;
        const image =
          l.product.images.find((img) => img.color === variant.color)?.url ??
          l.product.images[0]?.url ??
          l.product.thumbnailUrl ??
          l.product.imageUrl ??
          '';
        return {
          id: randomUUID(),
          order_id: orderRef.id,
          product_id: l.productId,
          variant_id: l.variantId,
          seller_id: sellerId,
          product_name: l.product.name,
          product_image: image,
          product_slug: l.product.slug,
          brand_name: brandNames.get(l.product.brand_id) ?? '',
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          quantity: l.quantity,
          unit_price: l.unitPrice,
          total_price: l.lineSubtotal,
          is_return_eligible: l.product.is_return_eligible,
          is_exchange_eligible: l.product.is_exchange_eligible,
          return_status: 'none',
          exchange_status: 'none',
        };
      });

      const timeline: OrderTimelineEvent[] = [{ status: 'placed', label: 'Order Placed', timestamp: nowIso }];

      const orderDoc: Omit<Order, 'id'> = {
        order_number: orderNumber,
        group_id: groupId,
        buyer_id: uid,
        seller_id: sellerId,
        status: 'placed',
        items,
        address,
        subtotal: sellerSubtotal,
        discount: sellerDiscount,
        shipping_fee: sellerShipping,
        tax: sellerTax,
        total: sellerTotal,
        coupon_code: appliedCouponCode,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        timeline,
        estimated_delivery: estimatedDelivery,
        placed_at: nowIso,
      };
      tx.set(orderRef, orderDoc);
      createdOrders.push({ sellerId, orderId: orderRef.id, total: sellerTotal });
    }

    cartDocsToDelete.forEach((ref) => tx.delete(ref));

    if (couponRef) {
      tx.update(couponRef, { used_count: FieldValue.increment(1) });
      // One usage record per checkout (not per seller sub-order — a multi-seller cart is still one
      // use of the coupon from the customer's perspective), written atomically with the order(s)
      // and the used_count increment — a checkout that fails before this point never consumes the
      // coupon (Section 7: "do not count a coupon as used merely because a customer clicked Apply").
      tx.set(db.collection('coupon_usages').doc(), {
        coupon_id: couponRef.id,
        coupon_code: appliedCouponCode,
        user_id: uid,
        order_group_id: groupId,
        discount_amount: discountTotal,
        used_at: nowIso,
      });
    }

    if (requestRef) {
      tx.set(requestRef, { orderNumber, groupId, buyer_id: uid, created_at: nowIso });
    }
    if (paymentReceiptRef) {
      tx.set(paymentReceiptRef, { orderNumber, groupId, buyer_id: uid, created_at: nowIso });
    }
  });

  // A concurrent duplicate call won the race and already placed this order — return its result
  // without re-sending notifications or re-evaluating low-stock alerts a second time.
  if (replay) {
    return replay;
  }

  // Side-effect notifications — best-effort, run after the transaction has committed.
  await createNotification({
    userId: uid,
    title: 'Order placed',
    message: `Your order ${orderNumber} has been placed successfully.`,
    type: 'order',
    link: `/orders/${orderNumber}`,
  });

  await Promise.all(
    createdOrders.map((o) =>
      createNotification({
        userId: o.sellerId,
        title: 'New order received',
        message: `You have a new order ${orderNumber} worth Rs. ${o.total}.`,
        type: 'new_order',
        link: `/seller/orders/${o.orderId}`,
      }),
    ),
  );

  await Promise.all(pendingAlerts.map(sendStockAlert));

  return { orderNumber, groupId };
}
