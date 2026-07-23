import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from '../lib/admin';
import { createNotification } from '../lib/notifications';
import type { Order, OrderStatus } from '../lib/types';

interface CancelOrderData {
  orderId: string;
}

const CANCELLABLE_STATUSES: OrderStatus[] = ['placed', 'confirmed', 'packed'];

export const cancelOrder = onCall<CancelOrderData>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to cancel an order.');
  }
  const { orderId } = request.data ?? ({} as CancelOrderData);
  if (!orderId) {
    throw new HttpsError('invalid-argument', 'orderId is required.');
  }

  const orderRef = db.collection('orders').doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Order not found.');
  }
  const order = snap.data() as Order;
  if (order.buyer_id !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'This order does not belong to you.');
  }
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw new HttpsError('failed-precondition', 'Order can no longer be cancelled.');
  }

  const nowIso = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    const freshSnap = await tx.get(orderRef);
    if (!freshSnap.exists) throw new HttpsError('not-found', 'Order not found.');
    const fresh = freshSnap.data() as Order;
    if (!CANCELLABLE_STATUSES.includes(fresh.status)) {
      throw new HttpsError('failed-precondition', 'Order can no longer be cancelled.');
    }

    const productIds = Array.from(new Set(fresh.items.map((item) => item.product_id)));
    const invRefs = productIds.map((id) => db.collection('inventory').doc(id));
    const invSnaps = await Promise.all(invRefs.map((ref) => tx.get(ref)));
    const invByProduct = new Map<string, DocumentSnapshot>();
    invSnaps.forEach((s) => invByProduct.set(s.id, s));

    for (const item of fresh.items) {
      const invSnap = invByProduct.get(item.product_id);
      if (!invSnap || !invSnap.exists) continue; // inventory doc missing — nothing to restore, don't block cancellation
      const inv = invSnap.data() as { variant_stock: Record<string, number> };
      const variantStock = { ...inv.variant_stock };
      variantStock[item.variant_id] = (variantStock[item.variant_id] ?? 0) + item.quantity;
      tx.update(invSnap.ref, {
        variant_stock: variantStock,
        total_stock: FieldValue.increment(item.quantity),
        updated_at: nowIso,
      });
    }

    const timeline = [...fresh.timeline, { status: 'cancelled' as const, label: 'Order Cancelled', timestamp: nowIso }];
    tx.update(orderRef, { status: 'cancelled', timeline });
  });

  await Promise.all([
    createNotification({
      userId: order.seller_id,
      title: 'Order cancelled',
      message: `Order ${order.order_number} was cancelled by the buyer.`,
      type: 'cancelled_order',
      link: `/seller/orders/${orderId}`,
    }),
    createNotification({
      userId: order.buyer_id,
      title: 'Order cancelled',
      message: `Your order ${order.order_number} has been cancelled.`,
      type: 'order',
      link: `/orders/${orderId}`,
    }),
  ]);

  return { success: true };
});
