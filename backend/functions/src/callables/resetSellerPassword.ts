import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from '../lib/admin';
import type { Profile } from '../lib/types';

interface ResetSellerPasswordData {
  sellerId: string;
}

/**
 * Head-Seller-only: authorizes a password reset for a seller and returns their email so the client
 * can trigger the same standard sendPasswordResetEmail flow used for Add Seller / Forgot Password.
 * This function performs the permission check only — it never sets or sees an actual password.
 */
export const resetSellerPassword = onCall<ResetSellerPasswordData>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const { sellerId } = request.data ?? ({} as ResetSellerPasswordData);
  if (!sellerId) {
    throw new HttpsError('invalid-argument', 'sellerId is required.');
  }

  const callerSnap = await db.collection('users').doc(request.auth.uid).get();
  const caller = callerSnap.data() as Profile | undefined;
  if (!caller || caller.role !== 'head_seller') {
    throw new HttpsError('permission-denied', "Only the Head Seller can reset a seller's password.");
  }

  const targetSnap = await db.collection('users').doc(sellerId).get();
  if (!targetSnap.exists) {
    throw new HttpsError('not-found', 'Seller not found.');
  }

  return { email: (targetSnap.data() as Profile).email };
});
