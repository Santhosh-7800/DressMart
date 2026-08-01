import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from '../lib/admin';
import type { Profile } from '../lib/types';

interface ResetStaffPasswordData {
  staffId: string;
}

/**
 * Head-Seller-only: authorizes a password reset for a staff account and returns their email so
 * the client can trigger the same standard sendPasswordResetEmail flow used everywhere else.
 * Mirrors resetSellerPassword.ts exactly — this function performs the permission check only, it
 * never sets or sees an actual password.
 */
export const resetStaffPassword = onCall<ResetStaffPasswordData>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const { staffId } = request.data ?? ({} as ResetStaffPasswordData);
  if (!staffId) {
    throw new HttpsError('invalid-argument', 'staffId is required.');
  }

  const callerSnap = await db.collection('users').doc(request.auth.uid).get();
  const caller = callerSnap.data() as Profile | undefined;
  if (!caller || caller.role !== 'head_seller') {
    throw new HttpsError('permission-denied', "Only the Head Seller can reset a staff member's password.");
  }

  const targetSnap = await db.collection('users').doc(staffId).get();
  if (!targetSnap.exists) {
    throw new HttpsError('not-found', 'Staff account not found.');
  }
  const target = targetSnap.data() as Profile;
  if (target.role !== 'staff') {
    throw new HttpsError('failed-precondition', 'This account is not a staff account.');
  }

  return { email: target.email };
});
