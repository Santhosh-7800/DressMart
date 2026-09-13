import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from '../lib/admin';
import { runCallable } from '../lib/callableGuard';
import { computeStockAlert, sendStockAlert } from '../lib/inventoryAlerts';
import { recordMovement } from '../lib/inventoryMovements';
import type { Inventory, Product, Profile, StaffPermissions } from '../lib/types';

interface AdjustStockData {
  productId: string;
  variantId: string;
  delta: number;
  reason: string;
}

const MAX_REASON_LENGTH = 200;

/**
 * Single-SKU stock correction with a mandatory, audited reason — the "+5 / -2, pick a reason"
 * workflow from Phase 12's brief. Deliberately separate from inventoryService.updateStock (the
 * existing bulk variant_stock editor, kept as-is for whole-product re-stocking) since this one:
 * (a) requires a reason, (b) records an inventory_movements entry, (c) is a signed delta rather
 * than an absolute overwrite, so two staff adjusting different variants concurrently can't clobber
 * each other the way two overlapping bulk-editor saves theoretically could.
 *
 * Mirrors firestore.rules' inventory/{productId} write condition exactly (Admin, or staff granted
 * manage_inventory scoped to their store) — this callable is the one path that's allowed to move
 * stock by more than what a customer purchase/return/exchange already accounts for, so its
 * authorization must match the rule, not be looser than it.
 */
export const adjustStock = onCall<AdjustStockData>(async (request) =>
  runCallable('Could not update stock. Please try again.', async () => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in.');
    }
    const { productId, variantId, delta, reason } = request.data ?? ({} as AdjustStockData);
    if (!productId || typeof productId !== 'string' || !variantId || typeof variantId !== 'string') {
      throw new HttpsError('invalid-argument', 'productId and variantId are required.');
    }
    if (!Number.isFinite(delta) || !Number.isInteger(delta) || delta === 0) {
      throw new HttpsError('invalid-argument', 'delta must be a non-zero whole number.');
    }
    if (!reason?.trim()) {
      throw new HttpsError('invalid-argument', 'A reason is required.');
    }
    if (reason.length > MAX_REASON_LENGTH) {
      throw new HttpsError('invalid-argument', `Reason must be ${MAX_REASON_LENGTH} characters or fewer.`);
    }

    const callerSnap = await db.collection('users').doc(request.auth.uid).get();
    const caller = callerSnap.data() as Profile | undefined;
    if (!caller) {
      throw new HttpsError('permission-denied', 'Account not found.');
    }

    const productRef = db.collection('products').doc(productId);
    const inventoryRef = db.collection('inventory').doc(productId);

    const result = await db.runTransaction(async (tx) => {
      const [productSnap, inventorySnap] = await Promise.all([tx.get(productRef), tx.get(inventoryRef)]);
      if (!productSnap.exists) {
        throw new HttpsError('not-found', 'Product not found.');
      }
      if (!inventorySnap.exists) {
        throw new HttpsError('not-found', 'Inventory record not found for this product.');
      }
      const product = productSnap.data() as Product;
      const inventory = inventorySnap.data() as Inventory;
      const variant = product.variants.find((v) => v.id === variantId);
      if (!variant) {
        throw new HttpsError('not-found', 'This size/color is no longer available on this product.');
      }

      const isAdmin = caller.role === 'admin';
      let isAuthorizedStaff = false;
      if (caller.role === 'staff' && caller.staff_status === 'active' && caller.seller_id === product.seller_id) {
        const permsSnap = await tx.get(db.collection('staff_permissions').doc(request.auth!.uid));
        const perms = permsSnap.data() as StaffPermissions | undefined;
        isAuthorizedStaff = perms?.manage_inventory === true;
      }
      if (!isAdmin && !isAuthorizedStaff) {
        throw new HttpsError('permission-denied', 'You are not authorized to adjust this product\'s stock.');
      }

      const previousQuantity = inventory.variant_stock[variantId] ?? 0;
      const newQuantity = previousQuantity + delta;
      if (newQuantity < 0) {
        throw new HttpsError('failed-precondition', `This would leave negative stock (current: ${previousQuantity}, change: ${delta}).`);
      }

      const newVariantStock = { ...inventory.variant_stock, [variantId]: newQuantity };
      const newTotalStock = Object.values(newVariantStock).reduce((sum, n) => sum + Math.max(0, Math.round(n || 0)), 0);
      const nowIso = new Date().toISOString();

      const { flags, alert } = computeStockAlert(inventory, newTotalStock, inventory.low_stock_threshold, {
        sellerId: inventory.seller_id,
        productId,
        productName: product.name,
      });

      tx.update(inventoryRef, {
        variant_stock: newVariantStock,
        total_stock: newTotalStock,
        updated_at: nowIso,
        low_stock_alert_sent: flags.low_stock_alert_sent,
        out_of_stock_alert_sent: flags.out_of_stock_alert_sent,
      });

      recordMovement(
        tx,
        {
          productId,
          variantId,
          sku: variant.sku,
          sellerId: inventory.seller_id,
          previousQuantity,
          quantityChanged: delta,
          newQuantity,
          movementType: delta > 0 ? 'manual_increase' : 'manual_decrease',
          reason: reason.trim(),
          performedBy: request.auth!.uid,
          performedByRole: caller.role,
        },
        nowIso,
      );

      return { newQuantity, newTotalStock, alert };
    });

    await sendStockAlert(result.alert);

    return { success: true, newQuantity: result.newQuantity, newTotalStock: result.newTotalStock };
  }),
);
