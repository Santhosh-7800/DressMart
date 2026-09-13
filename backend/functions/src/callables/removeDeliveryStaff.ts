import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { auth, db } from '../lib/admin';
import { runCallable } from '../lib/callableGuard';
import type { Profile } from '../lib/types';

interface RemoveDeliveryStaffData {
  deliveryStaffId: string;
}

const ACTIVE_DELIVERY_STATUSES = ['assigned', 'accepted', 'picked_up', 'out_for_delivery'];

/**
 * Admin-only hard delete of a delivery-personnel account. Unlike removeStaff.ts, a delivery
 * account CAN be the delivery_staff_id on in-progress orders — deleting it out from under an
 * active delivery would leave those orders pointing at a uid that no longer exists (and the
 * customer-facing tracking timeline would show a courier who can no longer be reached). Deactivate
 * (delivery_staff.status = 'inactive', a plain client write per firestore.rules) is the correct
 * action for someone still mid-delivery; this function only allows the hard delete once nothing is
 * actively assigned to them.
 */
export const removeDeliveryStaff = onCall<RemoveDeliveryStaffData>(async (request) =>
  runCallable('Could not remove this delivery person. Please try again.', async () => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in.');
    }
    const { deliveryStaffId } = request.data ?? ({} as RemoveDeliveryStaffData);
    if (!deliveryStaffId || typeof deliveryStaffId !== 'string') {
      throw new HttpsError('invalid-argument', 'deliveryStaffId is required.');
    }

    const callerSnap = await db.collection('users').doc(request.auth.uid).get();
    const caller = callerSnap.data() as Profile | undefined;
    if (!caller || caller.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Only the Admin can remove delivery personnel.');
    }

    const targetSnap = await db.collection('users').doc(deliveryStaffId).get();
    if (!targetSnap.exists) {
      throw new HttpsError('not-found', 'Delivery account not found.');
    }
    const target = targetSnap.data() as Profile;
    if (target.role !== 'delivery') {
      throw new HttpsError('failed-precondition', 'This account is not a delivery account.');
    }

    const activeOrdersSnap = await db
      .collection('orders')
      .where('delivery_staff_id', '==', deliveryStaffId)
      .where('delivery_status', 'in', ACTIVE_DELIVERY_STATUSES)
      .limit(1)
      .get();
    if (!activeOrdersSnap.empty) {
      throw new HttpsError(
        'failed-precondition',
        'This delivery person has an active delivery in progress. Reassign it first, or deactivate the account instead of removing it.',
      );
    }

    await auth.deleteUser(deliveryStaffId);
    await db.collection('delivery_staff').doc(deliveryStaffId).delete();
    await db.collection('users').doc(deliveryStaffId).delete();

    return { success: true };
  }),
);
