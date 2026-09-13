import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from '../lib/admin';
import { runCallable } from '../lib/callableGuard';
import { createNotification } from '../lib/notifications';
import type { DeliveryAssignmentEvent, DeliveryStaffProfile, Order, OrderStatus, Profile } from '../lib/types';

interface AssignDeliveryData {
  orderId: string;
  deliveryStaffId: string;
}

// Assignment/reassignment is only meaningful once an order is ready to hand off, and before it's
// physically in someone's hands — see the delivery_status guard below for the finer-grained check.
const ASSIGNABLE_ORDER_STATUSES: OrderStatus[] = ['packed', 'shipped', 'out_for_delivery'];
// A fresh assignment (no prior delivery_staff_id) is always allowed from ASSIGNABLE_ORDER_STATUSES.
// A REASSIGNMENT (one already exists) is only allowed while nothing physical has happened yet, or
// after a failed attempt — never mid-transit, and never once delivered.
const REASSIGNABLE_DELIVERY_STATUSES = ['assigned', 'accepted', 'failed'];

/**
 * Admin-only. Handles both fresh assignment and reassignment (Sections 6 & 7) with one
 * function — the two only differ in whether `order.delivery_staff_id` was already set, and using a
 * single, carefully-validated function is safer than two near-duplicate ones. Reassignment after a
 * FAILED delivery attempt also rewinds `order.status` back to 'packed' (the new delivery person
 * needs to physically re-collect the item) — see the comment below.
 */
export const assignDelivery = onCall<AssignDeliveryData>(async (request) =>
  runCallable('Could not assign this delivery. Please try again.', async () => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in.');
    }
    const { orderId, deliveryStaffId } = request.data ?? ({} as AssignDeliveryData);
    if (!orderId || typeof orderId !== 'string' || !deliveryStaffId || typeof deliveryStaffId !== 'string') {
      throw new HttpsError('invalid-argument', 'orderId and deliveryStaffId are required.');
    }

    const callerSnap = await db.collection('users').doc(request.auth.uid).get();
    const caller = callerSnap.data() as Profile | undefined;
    if (!caller || caller.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Only the Admin can assign deliveries.');
    }

    const deliveryStaffSnap = await db.collection('delivery_staff').doc(deliveryStaffId).get();
    if (!deliveryStaffSnap.exists) {
      throw new HttpsError('not-found', 'Delivery person not found.');
    }
    const deliveryStaff = deliveryStaffSnap.data() as DeliveryStaffProfile;
    if (deliveryStaff.status !== 'active') {
      throw new HttpsError('failed-precondition', 'This delivery person is inactive.');
    }

    const orderRef = db.collection('orders').doc(orderId);

    const result = await db.runTransaction(async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) {
        throw new HttpsError('not-found', 'Order not found.');
      }
      const order = orderSnap.data() as Order;

      if (!ASSIGNABLE_ORDER_STATUSES.includes(order.status)) {
        throw new HttpsError('failed-precondition', 'This order is not ready for delivery assignment.');
      }

      const previousStaffId = order.delivery_staff_id ?? null;
      const isReassignment = Boolean(previousStaffId) && previousStaffId !== deliveryStaffId;
      if (isReassignment && !REASSIGNABLE_DELIVERY_STATUSES.includes(order.delivery_status ?? 'unassigned')) {
        throw new HttpsError('failed-precondition', 'This delivery is already in progress and cannot be reassigned.');
      }
      // Re-assigning the SAME person while already 'assigned'/'accepted' is a harmless no-op status-
      // wise (idempotent — a retried/duplicate call), so it falls through the same path below.

      const nowIso = new Date().toISOString();
      const history: DeliveryAssignmentEvent[] = [...(order.delivery_history ?? [])];
      if (isReassignment) {
        const lastIdx = [...history].reverse().findIndex((h) => h.delivery_staff_id === previousStaffId && !h.unassigned_at);
        if (lastIdx !== -1) {
          const idx = history.length - 1 - lastIdx;
          history[idx] = { ...history[idx], unassigned_at: nowIso, outcome: 'reassigned' };
        }
      }
      history.push({
        delivery_staff_id: deliveryStaffId,
        delivery_staff_name: deliveryStaff.full_name,
        assigned_by: request.auth!.uid,
        assigned_at: nowIso,
      });

      // A reassignment following a failed attempt means the new person must physically re-collect
      // the item — rewind order.status to 'packed' so the happy-path (packed -> shipped -> ... )
      // plays out again for them. A fresh assignment never touches order.status at all.
      const wasFailed = order.delivery_status === 'failed';
      const updates: Record<string, unknown> = {
        delivery_staff_id: deliveryStaffId,
        delivery_staff_name: deliveryStaff.full_name,
        delivery_status: 'assigned',
        delivery_assigned_at: nowIso,
        delivery_assigned_by: request.auth!.uid,
        delivery_accepted_at: null,
        delivery_picked_up_at: null,
        delivery_out_for_delivery_at: null,
        delivery_delivered_at: null,
        delivery_failed_at: null,
        delivery_failure_reason: null,
        delivery_history: history,
      };
      if (wasFailed && (order.status === 'shipped' || order.status === 'out_for_delivery')) {
        updates.status = 'packed';
      }

      tx.update(orderRef, updates);
      return { order, previousStaffId, isReassignment };
    });

    await Promise.all([
      createNotification({
        userId: deliveryStaffId,
        title: result.isReassignment ? 'Delivery reassigned to you' : 'New delivery assigned',
        message: `Order ${result.order.order_number} has been assigned to you for delivery.`,
        type: 'delivery',
        link: '/delivery/dashboard',
      }),
      result.isReassignment && result.previousStaffId
        ? createNotification({
            userId: result.previousStaffId,
            title: 'Delivery reassigned',
            message: `Order ${result.order.order_number} has been reassigned to another delivery person.`,
            type: 'delivery',
            link: '/delivery/dashboard',
          })
        : Promise.resolve(),
      // Only notify the customer on a genuinely fresh assignment — an internal reassignment
      // (e.g. after a failed attempt) isn't something the customer needs a separate push for; they
      // already see the live tracking timeline.
      !result.previousStaffId
        ? createNotification({
            userId: result.order.buyer_id,
            title: 'Delivery partner assigned',
            message: `A delivery partner has been assigned to your order ${result.order.order_number}.`,
            type: 'delivery',
            link: `/orders/${orderId}`,
          })
        : Promise.resolve(),
    ]);

    return { success: true };
  }),
);
