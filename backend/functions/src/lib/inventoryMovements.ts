import type { Transaction } from 'firebase-admin/firestore';
import { db } from './admin';
import type { InventoryMovementType, UserRole } from './types';

export interface MovementInput {
  productId: string;
  variantId: string;
  sku: string;
  sellerId: string;
  previousQuantity: number;
  quantityChanged: number;
  newQuantity: number;
  movementType: InventoryMovementType;
  reason?: string | null;
  orderId?: string | null;
  returnId?: string | null;
  exchangeId?: string | null;
  performedBy: string;
  performedByRole: UserRole | 'system';
}

/** Writes one `inventory_movements/{autoId}` doc inside an existing transaction — call once per
 *  affected variant, right alongside the `tx.update`/`tx.set` that actually changes the inventory
 *  doc, so the audit record is atomic with the stock change it describes. Never updated/deleted. */
export function recordMovement(tx: Transaction, input: MovementInput, nowIso: string): void {
  const ref = db.collection('inventory_movements').doc();
  tx.set(ref, {
    product_id: input.productId,
    variant_id: input.variantId,
    sku: input.sku,
    seller_id: input.sellerId,
    previous_quantity: input.previousQuantity,
    quantity_changed: input.quantityChanged,
    new_quantity: input.newQuantity,
    movement_type: input.movementType,
    reason: input.reason ?? null,
    order_id: input.orderId ?? null,
    return_id: input.returnId ?? null,
    exchange_id: input.exchangeId ?? null,
    performed_by: input.performedBy,
    performed_by_role: input.performedByRole,
    created_at: nowIso,
  });
}
