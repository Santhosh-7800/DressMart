import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { auth, db } from '../lib/admin';
import { runCallable } from '../lib/callableGuard';
import type { Profile } from '../lib/types';

interface CreateAdminData {
  ownerName: string;
  storeName: string;
  email: string;
  phone?: string;
  password: string;
}

const SETUP_DOC = db.collection('system').doc('setup');

/**
 * Unauthenticated on purpose — this is the very first thing anyone does on a fresh install, before
 * any account exists. The "exactly one Admin, created exactly once" guarantee is enforced
 * server-side via a Firestore transaction on system/setup (public-read, write:false in
 * firestore.rules — only this function's Admin SDK transaction can ever set it), not just a
 * client-side redirect, so navigating straight to the setup page a second time can't create a
 * second Admin account even if the client-side guard were bypassed.
 *
 * The Auth account is created with the real password the owner typed (safe here — they're choosing
 * their own password, created server-side in one step). If the transaction below then finds an
 * Admin already exists (a race with another concurrent setup attempt), the just-created Auth
 * account is deleted again so no orphaned account is left behind.
 */
export const createAdmin = onCall<CreateAdminData>(async (request) =>
  runCallable('Could not complete Admin setup. Please try again.', async () => {
    const { ownerName, storeName, email, phone, password } = request.data ?? ({} as CreateAdminData);
    if (!ownerName?.trim() || !storeName?.trim() || !email?.trim() || !password) {
      throw new HttpsError('invalid-argument', 'ownerName, storeName, email, and password are required.');
    }
    if (password.length < 6) {
      throw new HttpsError('invalid-argument', 'Password must be at least 6 characters.');
    }

    let userRecord;
    try {
      userRecord = await auth.createUser({
        email: email.trim(),
        password,
        displayName: ownerName.trim(),
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'auth/email-already-exists') {
        throw new HttpsError('already-exists', 'A user with this email already exists.');
      }
      throw new HttpsError('internal', 'Could not create the account.');
    }

    try {
      await db.runTransaction(async (tx) => {
        const setupSnap = await tx.get(SETUP_DOC);
        if (setupSnap.exists && setupSnap.data()?.admin_created) {
          throw new HttpsError('already-exists', 'An Admin account already exists.');
        }

        const now = new Date().toISOString();
        const profile: Omit<Profile, 'id'> = {
          email: email.trim(),
          full_name: ownerName.trim(),
          phone: phone?.trim() || null,
          avatar_url: null,
          role: 'admin',
          created_at: now,
          updated_at: now,
          store_name: storeName.trim(),
          gst_number: '',
        };
        tx.set(db.collection('users').doc(userRecord.uid), profile);
        tx.set(SETUP_DOC, { admin_created: true, created_at: now });
      });
    } catch (err) {
      // Roll back the just-created Auth account — someone else's setup attempt won the race.
      await auth.deleteUser(userRecord.uid).catch(() => {});
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', 'Could not complete Admin setup.');
    }

    return { success: true, uid: userRecord.uid };
  }),
);
