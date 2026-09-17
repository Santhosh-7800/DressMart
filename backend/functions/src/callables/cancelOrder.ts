import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from '../lib/admin';
import { createNotification } from '../lib/notifications';
import { runCallable } from '../lib/callableGuard';
import { computeStockAlert } from '../lib/inventoryAlerts';
import { recordMovement } from '../lib/inventoryMovements';
import type { Inventory, Order, OrderStatus, Profile } from '../lib/types';

interface CancelOrderData {
  orderId: string;
}

const CANCELLABLE_STATUSES: OrderStatus[] = ['placed', 'confirmed', 'packed'];

/** The Admin may also cancel an order (not just the buyer), under the same rule a buyer can:
 *  still `placed`/`confirmed`/`packed`. */
function isCancellableByOwner(order: Order): boolean {
  return CANCELLABLE_STATUSES.includes(order.status);
}

export const cancelOrder = onCall<CancelOrderData>(async (request) =>
  runCallable('Your order could not be cancelled. Please try again.', async () => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in to cancel an order.');
    }
    const { orderId } = request.data ?? ({} as CancelOrderData);
    if (!orderId || typeof orderId !== 'string') {
      throw new HttpsError('invalid-argument', 'orderId is required.');
    }

    const orderRef = db.collection('orders').doc(orderId);
    const snap = await orderRef.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Order not found.');
    }
    const order = snap.data() as Order;
    const uid = request.auth.uid;

    let cancelledByOwner = false;
    let ownerRole: Profile['role'] | null = null;
    if (order.buyer_id === uid) {
      if (!CANCELLABLE_STATUSES.includes(order.status)) {
        throw new HttpsError('failed-precondition', 'Order can no longer be cancelled.');
      }
    } else {
      const callerSnap = await db.collection('users').doc(uid).get();
      const caller = callerSnap.data() as Profile | undefined;
      const isAuthorizedOwner = Boolean(caller) && caller!.role === 'admin';
      if (!isAuthorizedOwner) {
        throw new HttpsError('permission-denied', 'This order does not belong to you.');
      }
      if (!isCancellableByOwner(order)) {
        throw new HttpsError('failed-precondition', 'Order can no longer be cancelled.');
      }
      cancelledByOwner = true;
      ownerRole = caller!.role;
    }

    const nowIso = new Date().toISOString();

    await db.runTransaction(async (tx) => {
      const freshSnap = await tx.get(orderRef);
      if (!freshSnap.exists) throw new HttpsError('not-found', 'Order not found.');
      const fresh = freshSnap.data() as Order;
      const stillCancellable = cancelledByOwner ? isCancellableByOwner(fresh) : CANCELLABLE_STATUSES.includes(fresh.status);
      if (!stillCancellable) {
        throw new HttpsError('failed-precondition', 'Order can no longer be cancelled.');
      }

      const productIds = Array.from(new Set(fresh.items.map((item) => item.product_id)));
      const invRefs = productIds.map((id) => db.collection('inventory').doc(id));
      const productRefs = productIds.map((id) => db.collection('products').doc(id));
      const [invSnaps, productSnaps] = await Promise.all([
        Promise.all(invRefs.map((ref) => tx.get(ref))),
        Promise.all(productRefs.map((ref) => tx.get(ref))),
      ]);
      const invByProduct = new Map<string, DocumentSnapshot>();
      invSnaps.forEach((s) => invByProduct.set(s.id, s));
      const skuByVariant = new Map<string, string>();
      productSnaps.forEach((s) => {
        if (!s.exists) return;
        for (const v of (s.data() as { variants: { id: string; sku: string }[] }).variants) skuByVariant.set(v.id, v.sku);
      });

      for (const item of fresh.items) {
        const invSnap = invByProduct.get(item.product_id);
        if (!invSnap || !invSnap.exists) continue; // inventory doc missing — nothing to restore, don't block cancellation
        const inv = invSnap.data() as Inventory;
        const variantStock = { ...inv.variant_stock };
        const previousQuantity = variantStock[item.variant_id] ?? 0;
        const newQuantity = previousQuantity + item.quantity;
        variantStock[item.variant_id] = newQuantity;
        const newTotalStock = Object.values(variantStock).reduce((sum, n) => sum + Math.max(0, Math.round(n || 0)), 0);

        const { flags } = computeStockAlert(inv, newTotalStock, inv.low_stock_threshold, {
          sellerId: inv.seller_id,
          productId: item.product_id,
          productName: item.product_name,
        });

        tx.update(invSnap.ref, {
          variant_stock: variantStock,
          total_stock: newTotalStock,
          updated_at: nowIso,
          low_stock_alert_sent: flags.low_stock_alert_sent,
          out_of_stock_alert_sent: flags.out_of_stock_alert_sent,
        });

        recordMovement(
          tx,
          {
            productId: item.product_id,
            variantId: item.variant_id,
            sku: skuByVariant.get(item.variant_id) ?? item.variant_id,
            sellerId: inv.seller_id,
            previousQuantity,
            quantityChanged: item.quantity,
            newQuantity,
            movementType: 'cancellation',
            orderId,
            performedBy: uid,
            performedByRole: ownerRole ?? 'buyer',
          },
          nowIso,
        );
      }

      const timeline = [
        ...fresh.timeline,
        { status: 'cancelled' as const, label: cancelledByOwner ? 'Order Cancelled by DS LOOKS' : 'Order Cancelled', timestamp: nowIso },
      ];
      tx.update(orderRef, { status: 'cancelled', timeline });
    });

    await Promise.all([
      // Don't notify the admin when they're the one who just cancelled it themselves.
      order.seller_id !== uid
        ? createNotification({
            userId: order.seller_id,
            title: 'Order cancelled',
            message: cancelledByOwner ? `Order ${order.order_number} was cancelled.` : `Order ${order.order_number} was cancelled by the buyer.`,
            type: 'cancelled_order',
            link: `/admin/orders/${orderId}`,
          })
        : Promise.resolve(),
      createNotification({
        userId: order.buyer_id,
        title: 'Order cancelled',
        message: cancelledByOwner ? `Your order ${order.order_number} was cancelled by DS LOOKS. Please contact support if you have questions.` : `Your order ${order.order_number} has been cancelled.`,
        type: 'order',
        link: `/orders/${orderId}`,
      }),
    ]);

    return { success: true };
  }),
);
