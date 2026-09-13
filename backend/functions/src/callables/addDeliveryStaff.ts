import { randomUUID } from 'node:crypto';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { auth, db } from '../lib/admin';
import { runCallable } from '../lib/callableGuard';
import type { DeliveryStaffProfile, Profile } from '../lib/types';

interface AddDeliveryStaffData {
  fullName: string;
  email: string;
  phone: string;
}

/**
 * Admin-only: creates a brand-new delivery-personnel account. Mirrors addStaff.ts's
 * account-creation pattern exactly (random throwaway password, client follows up with
 * authService.requestPasswordReset) — no one, including the Admin, ever sets or knows
 * another user's actual password. Writes two docs: the auth-linked `users/{uid}` profile
 * (role: 'delivery' — what login/route-gating needs) and `delivery_staff/{uid}` (display/roster
 * info the owner's Delivery Personnel screen reads).
 */
export const addDeliveryStaff = onCall<AddDeliveryStaffData>(async (request) =>
  runCallable('Could not add this delivery person. Please try again.', async () => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in.');
    }
    const { fullName, email, phone } = request.data ?? ({} as AddDeliveryStaffData);
    if (!fullName?.trim() || !email?.trim() || !phone?.trim()) {
      throw new HttpsError('invalid-argument', 'fullName, email, and phone are required.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new HttpsError('invalid-argument', 'A valid email address is required.');
    }

    const callerSnap = await db.collection('users').doc(request.auth.uid).get();
    const caller = callerSnap.data() as Profile | undefined;
    if (!caller || caller.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Only the Admin can add delivery personnel.');
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
      throw new HttpsError('internal', 'Could not create the delivery account.');
    }

    const now = new Date().toISOString();
    const profile: Omit<Profile, 'id'> = {
      email: email.trim(),
      full_name: fullName.trim(),
      phone: phone.trim(),
      avatar_url: null,
      role: 'delivery',
      created_at: now,
      updated_at: now,
      delivery_staff_status: 'active',
      delivery_staff_status_reason: null,
    };
    await db.collection('users').doc(userRecord.uid).set(profile);

    const deliveryProfile: Omit<DeliveryStaffProfile, 'id'> = {
      full_name: fullName.trim(),
      phone: phone.trim(),
      status: 'active',
      status_reason: null,
      created_by: request.auth.uid,
      created_at: now,
      updated_at: now,
    };
    await db.collection('delivery_staff').doc(userRecord.uid).set(deliveryProfile);

    return { success: true, uid: userRecord.uid };
  }),
);
