import { randomUUID } from 'node:crypto';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { auth, db } from '../lib/admin';
import type { Profile } from '../lib/types';

interface AddSellerData {
  fullName: string;
  email: string;
  phone?: string;
  storeName: string;
  gstNumber?: string;
}

/**
 * Head-Seller-only: creates a brand-new seller account directly (as opposed to approving an
 * existing buyer's application via reviewSellerRequest). Auth requires *some* password at creation
 * — a random one is set here and immediately discarded; the client follows this call with
 * authService.requestPasswordReset(email) (plain sendPasswordResetEmail) so the seller sets their
 * own real password via Firebase's standard email flow. No one — including the Head Seller — ever
 * sets or knows another user's actual password.
 */
export const addSeller = onCall<AddSellerData>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const { fullName, email, phone, storeName, gstNumber } = request.data ?? ({} as AddSellerData);
  if (!fullName?.trim() || !email?.trim() || !storeName?.trim()) {
    throw new HttpsError('invalid-argument', 'fullName, email, and storeName are required.');
  }

  const callerSnap = await db.collection('users').doc(request.auth.uid).get();
  const caller = callerSnap.data() as Profile | undefined;
  if (!caller || caller.role !== 'head_seller') {
    throw new HttpsError('permission-denied', 'Only the Head Seller can add sellers.');
  }

  let userRecord;
  try {
    userRecord = await auth.createUser({
      email: email.trim(),
      password: randomUUID(),
      displayName: fullName.trim(),
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'A user with this email already exists.');
    }
    throw new HttpsError('internal', 'Could not create the seller account.');
  }

  const now = new Date().toISOString();
  const profile: Omit<Profile, 'id'> = {
    email: email.trim(),
    full_name: fullName.trim(),
    phone: phone?.trim() || null,
    avatar_url: null,
    role: 'seller',
    created_at: now,
    updated_at: now,
    store_name: storeName.trim(),
    gst_number: gstNumber?.trim() || '',
    seller_status: 'approved',
    seller_applied_at: now,
    seller_approved_at: now,
    seller_status_reason: null,
  };
  await db.collection('users').doc(userRecord.uid).set(profile);

  return { success: true, uid: userRecord.uid };
});
