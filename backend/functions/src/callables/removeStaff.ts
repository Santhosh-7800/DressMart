import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { auth, db } from '../lib/admin';
import type { Profile, StaffProfile } from '../lib/types';

interface RemoveStaffData {
  staffId: string;
}

/**
 * Head-Seller-only hard delete of a staff account — unlike removeSeller.ts, staff never own
 * products/orders themselves (everything they touch is attributed to the store's own seller_id),
 * so there's no order-history guard or product/inventory cleanup needed here; just the Auth
 * account and the two staff-only profile docs.
 */
export const removeStaff = onCall<RemoveStaffData>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const { staffId } = request.data ?? ({} as RemoveStaffData);
  if (!staffId) {
    throw new HttpsError('invalid-argument', 'staffId is required.');
  }

  const callerSnap = await db.collection('users').doc(request.auth.uid).get();
  const caller = callerSnap.data() as Profile | undefined;
  if (!caller || caller.role !== 'head_seller') {
    throw new HttpsError('permission-denied', 'Only the Head Seller can remove staff.');
  }

  const targetSnap = await db.collection('users').doc(staffId).get();
  if (!targetSnap.exists) {
    throw new HttpsError('not-found', 'Staff account not found.');
  }
  const target = targetSnap.data() as Profile;
  if (target.role !== 'staff') {
    throw new HttpsError('failed-precondition', 'This account is not a staff account.');
  }

  const staffDocSnap = await db.collection('staff').doc(staffId).get();
  const staffDoc = staffDocSnap.data() as StaffProfile | undefined;
  if (staffDoc && staffDoc.seller_id !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'You can only remove staff you created.');
  }

  await auth.deleteUser(staffId);
  await db.collection('staff_permissions').doc(staffId).delete();
  await db.collection('staff').doc(staffId).delete();
  await db.collection('users').doc(staffId).delete();

  return { success: true };
});
