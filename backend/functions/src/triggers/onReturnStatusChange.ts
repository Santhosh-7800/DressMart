import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { db } from '../lib/admin';
import { createNotificationOnce } from '../lib/notifications';
import { computeStockAlert } from '../lib/inventoryAlerts';
import { recordMovement } from '../lib/inventoryMovements';
import type { Inventory, Order, Product, ReturnRequest, ReturnStatus } from '../lib/types';

const STATUS_LABEL: Record<ReturnStatus, string> = {
  requested: 'submitted',
  approved: 'approved',
  rejected: 'rejected',
  pickup_scheduled: 'scheduled for pickup',
  received: 'received back at the warehouse',
  refunded: 'refunded',
};

// The item is only physically back in the shop's hands once it's marked 'received' — restoring
// stock any earlier (e.g. on 'approved') would let a customer keep using the item while it's
// already counted as sellable again. 'refunded' is a downstream financial step that doesn't
// change physical stock and is intentionally not a restoration trigger.
const RESTORE_AT_STATUS: ReturnStatus = 'received';

export const onReturnStatusChange = onDocumentUpdated('returns/{returnId}', async (event) => {
  const before = event.data?.before.data() as ReturnRequest | undefined;
  const after = event.data?.after.data() as ReturnRequest | undefined;
  if (!before || !after || before.status === after.status) return;

  await createNotificationOnce(`return:${event.params.returnId}:${after.status}`, {
    userId: after.buyer_id,
    title: 'Return update',
    message: `Your return request has been ${STATUS_LABEL[after.status]}.`,
    type: 'return',
    link: `/orders/${after.order_id}`,
  });

  // Mirror the new status onto the matching order_item inside the parent order doc — Firestore
  // can't patch a single array element directly, so read -> map -> write back the whole array.
  const orderRef = db.collection('orders').doc(after.order_id);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) return;
  const order = orderSnap.data() as Order;
  let changed = false;
  const items = order.items.map((item) => {
    if (item.id !== after.order_item_id) return item;
    changed = true;
    return { ...item, return_status: after.status };
  });
  if (changed) {
    await orderRef.update({ items });
  }

  if (after.status !== RESTORE_AT_STATUS) return;

  // Restore stock exactly once, inside a transaction guarded by `inventory_restored` — protects
  // against this trigger being redelivered by the platform, and against the return doc being
  // written to 'received' more than once.
  const returnRef = event.data!.after.ref;
  await db.runTransaction(async (tx) => {
    const [returnSnap, freshOrderSnap] = await Promise.all([tx.get(returnRef), tx.get(orderRef)]);
    if (!returnSnap.exists) return;
    const freshReturn = returnSnap.data() as ReturnRequest;
    if (freshReturn.inventory_restored) return;
    if (!freshOrderSnap.exists) return;

    const freshOrder = freshOrderSnap.data() as Order;
    const item = freshOrder.items.find((i) => i.id === freshReturn.order_item_id);
    if (!item) return;

    const invRef = db.collection('inventory').doc(item.product_id);
    const productRef = db.collection('products').doc(item.product_id);
    const [invSnap, productSnap] = await Promise.all([tx.get(invRef), tx.get(productRef)]);
    if (invSnap.exists) {
      const inv = invSnap.data() as Inventory;
      const variantStock = { ...inv.variant_stock };
      const previousQuantity = variantStock[item.variant_id] ?? 0;
      // This return request covers the entire order_item line (there's no sub-line-item partial-
      // quantity model in ReturnRequest today), so item.quantity is exactly what was purchased on
      // this line — restoring it here can never over- or under-restore relative to what was sold.
      const newQuantity = previousQuantity + item.quantity;
      variantStock[item.variant_id] = newQuantity;
      const newTotalStock = Object.values(variantStock).reduce((sum, n) => sum + Math.max(0, Math.round(n || 0)), 0);
      const nowIso = new Date().toISOString();

      const product = productSnap.exists ? (productSnap.data() as Product) : null;
      const sku = product?.variants.find((v) => v.id === item.variant_id)?.sku ?? item.variant_id;

      const { flags } = computeStockAlert(inv, newTotalStock, inv.low_stock_threshold, {
        sellerId: inv.seller_id,
        productId: item.product_id,
        productName: product?.name ?? item.product_name,
      });

      tx.update(invRef, {
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
          sku,
          sellerId: inv.seller_id,
          previousQuantity,
          quantityChanged: item.quantity,
          newQuantity,
          movementType: 'return',
          returnId: event.params.returnId,
          orderId: after.order_id,
          performedBy: 'system',
          performedByRole: 'system',
        },
        nowIso,
      );
    }

    tx.update(returnRef, { inventory_restored: true });
  });
});
