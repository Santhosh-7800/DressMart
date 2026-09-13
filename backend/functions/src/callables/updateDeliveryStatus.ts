import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from '../lib/admin';
import { runCallable } from '../lib/callableGuard';
import { createNotification } from '../lib/notifications';
import type { DeliveryNoteEvent, DeliveryStatus, Order, OrderStatus, OrderTimelineEvent, Profile } from '../lib/types';

type DeliveryAction = 'accept' | 'picked_up' | 'out_for_delivery' | 'delivered' | 'failed' | 'note';

interface UpdateDeliveryStatusData {
  orderId: string;
  action: DeliveryAction;
  reason?: string;
  note?: string;
}

const MAX_NOTE_LENGTH = 300;

const TRANSITIONS: Partial<Record<DeliveryAction, { from: DeliveryStatus; to: DeliveryStatus; orderStatus?: { from: OrderStatus; to: OrderStatus; label: string } }>> = {
  accept: { from: 'assigned', to: 'accepted' },
  picked_up: { from: 'accepted', to: 'picked_up', orderStatus: { from: 'packed', to: 'shipped', label: 'Shipped' } },
  out_for_delivery: { from: 'picked_up', to: 'out_for_delivery', orderStatus: { from: 'shipped', to: 'out_for_delivery', label: 'Out for Delivery' } },
  delivered: { from: 'out_for_delivery', to: 'delivered', orderStatus: { from: 'out_for_delivery', to: 'delivered', label: 'Delivered' } },
  failed: { from: 'out_for_delivery', to: 'failed' },
};

/**
 * Delivery-staff-only. One function covers every delivery-staff-driven transition (accept, picked
 * up, out for delivery, delivered, failed) plus attaching a standalone note — a single, carefully
 * validated transition table is safer and easier to audit than five near-duplicate callables. The
 * caller must be the order's own `delivery_staff_id` (never just "any delivery account"), closing
 * the exact gap Phase 11 called out: being signed in as role 'delivery' is not, by itself,
 * authorization to touch a specific order.
 *
 * Where a transition also advances the order's main `status` (packed->shipped->out_for_delivery->
 * delivered), that write happens in the same transaction — the existing onOrderStatusChange
 * Firestore trigger then fires the customer notification for free, exactly as it already does for
 * a seller-driven status advance. No notification code is duplicated here for those three steps.
 */
export const updateDeliveryStatus = onCall<UpdateDeliveryStatusData>(async (request) =>
  runCallable('Could not update this delivery. Please try again.', async () => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in.');
    }
    const { orderId, action, reason, note } = request.data ?? ({} as UpdateDeliveryStatusData);
    if (!orderId || typeof orderId !== 'string') {
      throw new HttpsError('invalid-argument', 'orderId is required.');
    }
    const validActions: DeliveryAction[] = ['accept', 'picked_up', 'out_for_delivery', 'delivered', 'failed', 'note'];
    if (!validActions.includes(action)) {
      throw new HttpsError('invalid-argument', 'A valid action is required.');
    }
    if (action === 'failed' && !reason?.trim()) {
      throw new HttpsError('invalid-argument', 'A reason is required to report a failed delivery.');
    }
    if (action === 'note' && !note?.trim()) {
      throw new HttpsError('invalid-argument', 'A note is required.');
    }
    if (note && note.length > MAX_NOTE_LENGTH) {
      throw new HttpsError('invalid-argument', `Notes must be ${MAX_NOTE_LENGTH} characters or fewer.`);
    }

    const callerSnap = await db.collection('users').doc(request.auth.uid).get();
    const caller = callerSnap.data() as Profile | undefined;
    if (!caller || caller.role !== 'delivery') {
      throw new HttpsError('permission-denied', 'Only delivery personnel can update a delivery.');
    }
    const deliveryStaffSnap = await db.collection('delivery_staff').doc(request.auth.uid).get();
    const deliveryStaffDoc = deliveryStaffSnap.data() as { status?: string } | undefined;
    if (!deliveryStaffDoc || deliveryStaffDoc.status !== 'active') {
      throw new HttpsError('permission-denied', 'This delivery account is inactive.');
    }

    const orderRef = db.collection('orders').doc(orderId);

    const result = await db.runTransaction(async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) {
        throw new HttpsError('not-found', 'Order not found.');
      }
      const order = orderSnap.data() as Order;
      if (order.delivery_staff_id !== request.auth!.uid) {
        throw new HttpsError('permission-denied', 'This order is not assigned to you.');
      }

      const nowIso = new Date().toISOString();
      const noteEvent: DeliveryNoteEvent | null = note?.trim()
        ? { note: note.trim(), added_by: request.auth!.uid, added_by_name: caller.full_name, added_at: nowIso }
        : null;

      if (action === 'note') {
        tx.update(orderRef, { delivery_notes: [...(order.delivery_notes ?? []), noteEvent] });
        return { alreadyApplied: false, order, action };
      }

      const transition = TRANSITIONS[action]!;
      const current = order.delivery_status ?? 'unassigned';
      if (current === transition.to) {
        // Idempotent retry (double tap / network retry / notification redelivery) — already applied.
        if (noteEvent) tx.update(orderRef, { delivery_notes: [...(order.delivery_notes ?? []), noteEvent] });
        return { alreadyApplied: true, order, action };
      }
      if (current !== transition.from) {
        throw new HttpsError('failed-precondition', `Cannot mark as ${action.replace(/_/g, ' ')} from the current delivery status.`);
      }

      const updates: Record<string, unknown> = { delivery_status: transition.to };
      if (action === 'accept') updates.delivery_accepted_at = nowIso;
      if (action === 'picked_up') updates.delivery_picked_up_at = nowIso;
      if (action === 'out_for_delivery') updates.delivery_out_for_delivery_at = nowIso;
      if (action === 'delivered') updates.delivery_delivered_at = nowIso;
      if (action === 'failed') {
        updates.delivery_failed_at = nowIso;
        updates.delivery_failure_reason = reason!.trim();
      }
      if (noteEvent) updates.delivery_notes = [...(order.delivery_notes ?? []), noteEvent];

      if (transition.orderStatus && order.status === transition.orderStatus.from) {
        const event: OrderTimelineEvent = { status: transition.orderStatus.to, label: transition.orderStatus.label, timestamp: nowIso };
        updates.status = transition.orderStatus.to;
        updates.timeline = [...order.timeline, event];
      }

      tx.update(orderRef, updates);
      return { alreadyApplied: false, order, action };
    });

    if (!result.alreadyApplied && result.action === 'failed') {
      await Promise.all([
        createNotification({
          userId: result.order.buyer_id,
          title: 'Delivery attempt failed',
          message: `We couldn't deliver your order ${result.order.order_number}. Our team will contact you shortly.`,
          type: 'delivery',
          link: `/orders/${orderId}`,
        }),
        createNotification({
          userId: result.order.seller_id,
          title: 'Delivery failed — review needed',
          message: `Order ${result.order.order_number}'s delivery attempt failed: ${reason!.trim()}`,
          type: 'delivery',
          link: `/seller/orders`,
        }),
      ]);
    }

    return { success: true };
  }),
);
