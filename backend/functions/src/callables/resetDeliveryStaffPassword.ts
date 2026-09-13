import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from '../lib/admin';
import type { Profile } from '../lib/types';

interface ResetDeliveryStaffPasswordData {
  deliveryStaffId: string;
}

/**
 * Admin-only: authorizes a password reset for a delivery account and returns their email so
 * the client can trigger the same standard sendPasswordResetEmail flow used everywhere else.
 * Mirrors resetStaffPassword.ts exactly — this function performs the permission check only, it
 * never sets or sees an actual password.
 */
export const resetDeliveryStaffPassword = onCall<ResetDeliveryStaffPasswordData>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const { deliveryStaffId } = request.data ?? ({} as ResetDeliveryStaffPasswordData);
  if (!deliveryStaffId || typeof deliveryStaffId !== 'string') {
    throw new HttpsError('invalid-argument', 'deliveryStaffId is required.');
  }

  const callerSnap = await db.collection('users').doc(request.auth.uid).get();
  const caller = callerSnap.data() as Profile | undefined;
  if (!caller || caller.role !== 'admin') {
    throw new HttpsError('permission-denied', "Only the Admin can reset a delivery person's password.");
  }

  const targetSnap = await db.collection('users').doc(deliveryStaffId).get();
  if (!targetSnap.exists) {
    throw new HttpsError('not-found', 'Delivery account not found.');
  }
  const target = targetSnap.data() as Profile;
  if (target.role !== 'delivery') {
    throw new HttpsError('failed-precondition', 'This account is not a delivery account.');
  }

  return { email: target.email };
});
