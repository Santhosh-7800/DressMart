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

export async function placeOrderInternal(args: PlaceOrderArgs): Promise<PlaceOrderResult> {
  const {
    uid,
    addressId,
    couponCode,
    cart,
    paymentMethod,
    paymentStatus,
    razorpayOrderId = null,
    razorpayPaymentId = null,
    clientRequestId,
  } = args;

  if (!addressId) {
    throw new HttpsError('invalid-argument', 'addressId is required.');
  }
  if (!Array.isArray(cart) || cart.length === 0) {
    throw new HttpsError('invalid-argument', 'Cart is empty.');
  }

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

  // Defensively aggregate duplicate (productId, variantId) lines so stock is only checked/decremented once per pair.
  const aggregated = new Map<string, CartLineInput>();
  for (const line of cart) {
    if (!line?.productId || !line?.variantId || !Number.isFinite(line.quantity) || line.quantity <= 0) {
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
    const couponQuery = await db.collection('coupons').where('code', '==', couponCode).limit(1).get();
    if (couponQuery.empty) {
      throw new HttpsError('failed-precondition', 'Invalid coupon code.');
    }
    const couponDoc = couponQuery.docs[0];
    const coupon = couponDoc.data() as Coupon;
    const now = new Date();
    const isExpired = now < new Date(coupon.valid_from) || now > new Date(coupon.valid_until);
    const isExhausted = coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit;
    const belowMinOrder = grandSubtotal < coupon.min_order_value;
    if (!coupon.is_active || isExpired || isExhausted || belowMinOrder) {
      throw new HttpsError('failed-precondition', 'This coupon is not applicable to your order.');
    }
    discountTotal =
      coupon.discount_type === 'percent' ? (grandSubtotal * coupon.discount_value) / 100 : coupon.discount_value;
    if (coupon.max_discount != null) {
      discountTotal = Math.min(discountTotal, coupon.max_discount);
    }
    discountTotal = round2(discountTotal);
    appliedCouponCode = coupon.code;
    couponRef = couponDoc.ref;
  }

  // 5. Shipping config.
  const settingsSnap = await db.collection('platform_settings').doc('config').get();
  const settings = settingsSnap.exists ? (settingsSnap.data() as PlatformSettings) : null;
  const shippingFeeFlat = settings?.shipping_charge ?? DEFAULT_SHIPPING_FEE;
  const freeShippingThreshold = settings?.free_shipping_threshold ?? DEFAULT_FREE_SHIPPING_THRESHOLD;

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

  const lowStockCandidates: { productId: string; productName: string; sellerId: string }[] = [];
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
      const variantQtys = qtyByProduct.get(productId)!;
      const newVariantStock: Record<string, number> = { ...inv.variant_stock };
      let totalDelta = 0;
      for (const [variantId, qty] of variantQtys.entries()) {
        const current = newVariantStock[variantId] ?? 0;
        if (current < qty) {
          throw new HttpsError(
            'failed-precondition',
            `Insufficient stock for "${products.get(productId)?.name ?? productId}".`,
          );
        }
        newVariantStock[variantId] = current - qty;
        totalDelta += qty;
      }
      const newTotalStock = Math.max(0, inv.total_stock - totalDelta);
      tx.update(db.collection('inventory').doc(productId), {
        variant_stock: newVariantStock,
        total_stock: newTotalStock,
        updated_at: nowIso,
      });
      if (newTotalStock <= inv.low_stock_threshold) {
        lowStockCandidates.push({
          productId,
          productName: products.get(productId)?.name ?? productId,
          sellerId: inv.seller_id,
        });
      }
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
    }

    if (requestRef) {
      tx.set(requestRef, { orderNumber, groupId, buyer_id: uid, created_at: nowIso });
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

  const seenProducts = new Set<string>();
  const uniqueLowStock = lowStockCandidates.filter((c) => {
    if (seenProducts.has(c.productId)) return false;
    seenProducts.add(c.productId);
    return true;
  });
  await Promise.all(
    uniqueLowStock.map((c) =>
      createNotification({
        userId: c.sellerId,
        title: 'Low stock alert',
        message: `"${c.productName}" is running low on stock.`,
        type: 'low_stock',
        link: `/seller/inventory`,
      }),
    ),
  );

  return { orderNumber, groupId };
}
