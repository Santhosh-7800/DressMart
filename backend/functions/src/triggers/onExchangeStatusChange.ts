import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { db } from '../lib/admin';
import { createNotificationOnce } from '../lib/notifications';
import { computeStockAlert } from '../lib/inventoryAlerts';
import { recordMovement } from '../lib/inventoryMovements';
import type { ExchangeRequest, ExchangeStatus, Inventory, Order, Product } from '../lib/types';

const STATUS_LABEL: Record<ExchangeStatus, string> = {
  requested: 'submitted',
  approved: 'approved',
  rejected: 'rejected',
  pickup_scheduled: 'scheduled for pickup',
  exchanged: 'completed',
};

// Stock only actually moves once the physical swap has happened — 'exchanged' is the terminal,
// completed state (see STATUS_LABEL above); every earlier status is not yet a physical event.
const RESTORE_AT_STATUS: ExchangeStatus = 'exchanged';

export const onExchangeStatusChange = onDocumentUpdated('exchanges/{exchangeId}', async (event) => {
  const before = event.data?.before.data() as ExchangeRequest | undefined;
  const after = event.data?.after.data() as ExchangeRequest | undefined;
  if (!before || !after || before.status === after.status) return;

  await createNotificationOnce(`exchange:${event.params.exchangeId}:${after.status}`, {
    userId: after.buyer_id,
    title: 'Exchange update',
    message: `Your exchange request has been ${STATUS_LABEL[after.status]}.`,
    type: 'exchange',
    link: `/orders/${after.order_id}`,
  });

  const orderRef = db.collection('orders').doc(after.order_id);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) return;
  const order = orderSnap.data() as Order;
  let changed = false;
  const items = order.items.map((item) => {
    if (item.id !== after.order_item_id) return item;
    changed = true;
    return { ...item, exchange_status: after.status };
  });
  if (changed) {
    await orderRef.update({ items });
  }

  if (after.status !== RESTORE_AT_STATUS) return;

  // Swap stock exactly once, inside a transaction guarded by `inventory_restored` — protects
  // against this trigger being redelivered, and against the exchange doc reaching 'exchanged'
  // more than once.
  const exchangeRef = event.data!.after.ref;
  await db.runTransaction(async (tx) => {
    const [exchangeSnap, freshOrderSnap] = await Promise.all([tx.get(exchangeRef), tx.get(orderRef)]);
    if (!exchangeSnap.exists) return;
    const freshExchange = exchangeSnap.data() as ExchangeRequest;
    if (freshExchange.inventory_restored) return;
    if (!freshOrderSnap.exists) return;

    const freshOrder = freshOrderSnap.data() as Order;
    const item = freshOrder.items.find((i) => i.id === freshExchange.order_item_id);
    if (!item) return;

    const oldVariantId = item.variant_id;
    const newVariantId = freshExchange.desired_variant_id;

    // An exchange is always a different variant of the SAME product (desired_size/desired_color
    // describe another variant on this item's product_id, never a different product) — so both
    // sides of the swap live in one inventory doc.
    const invRef = db.collection('inventory').doc(item.product_id);
    const productRef = db.collection('products').doc(item.product_id);
    const [invSnap, productSnap] = await Promise.all([tx.get(invRef), tx.get(productRef)]);
    if (invSnap.exists && oldVariantId !== newVariantId) {
      const inv = invSnap.data() as Inventory;
      const product = productSnap.exists ? (productSnap.data() as Product) : null;
      const variantStock = { ...inv.variant_stock };
      const previousOldQuantity = variantStock[oldVariantId] ?? 0;
      const previousNewQuantity = variantStock[newVariantId] ?? 0;
      // Restore the returned (old) variant first...
      variantStock[oldVariantId] = previousOldQuantity + item.quantity;
      // ...then decrement the newly-issued variant, clamped so it can never go negative. In the
      // normal case (enough stock of the new variant) this nets to zero total_stock change, since
      // it's the same product; if stock was short, we clamp the decrement rather than going
      // negative, which slightly over-counts total_stock instead of corrupting it.
      const decrementBy = Math.min(item.quantity, previousNewQuantity);
      variantStock[newVariantId] = previousNewQuantity - decrementBy;
      const nowIso = new Date().toISOString();
      const newTotalStock = Object.values(variantStock).reduce((sum, n) => sum + Math.max(0, Math.round(n || 0)), 0);

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

      const oldSku = product?.variants.find((v) => v.id === oldVariantId)?.sku ?? oldVariantId;
      const newSku = product?.variants.find((v) => v.id === newVariantId)?.sku ?? newVariantId;
      const movementBase = {
        productId: item.product_id,
        sellerId: inv.seller_id,
        exchangeId: event.params.exchangeId,
        orderId: after.order_id,
        performedBy: 'system' as const,
        performedByRole: 'system' as const,
      };
      recordMovement(
        tx,
        { ...movementBase, variantId: oldVariantId, sku: oldSku, previousQuantity: previousOldQuantity, quantityChanged: item.quantity, newQuantity: variantStock[oldVariantId], movementType: 'exchange_in' },
        nowIso,
      );
      recordMovement(
        tx,
        { ...movementBase, variantId: newVariantId, sku: newSku, previousQuantity: previousNewQuantity, quantityChanged: -decrementBy, newQuantity: variantStock[newVariantId], movementType: 'exchange_out' },
        nowIso,
      );
    }

    tx.update(exchangeRef, { inventory_restored: true });
  });
});
