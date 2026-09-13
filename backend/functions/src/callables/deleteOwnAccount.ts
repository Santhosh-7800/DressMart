import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { auth, db } from '../lib/admin';
import { runCallable } from '../lib/callableGuard';
import type { Profile } from '../lib/types';

const BATCH_CHUNK_SIZE = 400;

/**
 * Buyer-only self-service account deletion. Scoped to the 'buyer' role deliberately — an admin,
 * staff, or delivery account owns/is referenced by products, inventory, staff rosters, or
 * in-progress deliveries, and staff/delivery already have their own dedicated removal flow
 * (removeStaff/removeDeliveryStaff) with the right cross-document cleanup for that role; this
 * function does not attempt to generalize to those (there is deliberately no self- or
 * admin-triggered deletion path for the single Admin account itself).
 *
 * Deliberately does NOT touch `orders` — an order is the business's own transaction/fulfillment
 * record (inventory movements, payment records, and the store's own accounting all reference it),
 * not solely the buyer's personal data, and Phase 14's brief is explicit that operationally/
 * legally relevant records must be preserved rather than destroyed. What IS deleted is every
 * collection that exists purely to serve this customer's own experience (addresses, wishlist,
 * activity/search history, notifications); the profile itself and this user's own reviews are
 * anonymized rather than deleted outright, since deleting the profile doc risks dangling
 * `buyer_id`/`user_id` references elsewhere (order history, review lists) that other parts of the
 * app assume resolve to *something*, and a review's content remains useful product feedback for
 * other shoppers even once its author's identity is gone.
 */
export const deleteOwnAccount = onCall(async (request) =>
  runCallable('Could not delete your account. Please try again.', async () => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in.');
    }
    const uid = request.auth.uid;

    const callerSnap = await db.collection('users').doc(uid).get();
    const caller = callerSnap.data() as Profile | undefined;
    if (!caller) {
      throw new HttpsError('not-found', 'Account not found.');
    }
    if (caller.role !== 'buyer') {
      throw new HttpsError(
        'failed-precondition',
        'This account type cannot be self-deleted here. Contact the Admin to remove a staff or delivery account.',
      );
    }

    const now = new Date().toISOString();

    // Anonymize this user's own reviews — content stays (still useful to other shoppers), identity
    // doesn't. Left in a batch loop (not a transaction) since a customer's review count has no
    // upper bound the way, say, an order's line items do; chunking avoids the 500-write batch limit.
    const reviewsSnap = await db.collection('reviews').where('user_id', '==', uid).get();
    for (let i = 0; i < reviewsSnap.docs.length; i += BATCH_CHUNK_SIZE) {
      const batch = db.batch();
      for (const doc of reviewsSnap.docs.slice(i, i + BATCH_CHUNK_SIZE)) {
        batch.update(doc.ref, { user_name: 'Deleted User', user_avatar: null });
      }
      await batch.commit();
    }

    // Delete every collection that exists solely to serve this customer's own experience.
    const [addressesSnap, wishlistSnap, notificationsSnap] = await Promise.all([
      db.collection('addresses').where('user_id', '==', uid).get(),
      db.collection('wishlist').where('user_id', '==', uid).get(),
      db.collection('notifications').where('user_id', '==', uid).get(),
    ]);
    const ownedDocs = [...addressesSnap.docs, ...wishlistSnap.docs, ...notificationsSnap.docs];
    for (let i = 0; i < ownedDocs.length; i += BATCH_CHUNK_SIZE) {
      const batch = db.batch();
      for (const doc of ownedDocs.slice(i, i + BATCH_CHUNK_SIZE)) {
        batch.delete(doc.ref);
      }
      await batch.commit();
    }
    await db.collection('user_activity').doc(uid).delete();

    // Anonymize (not delete) the profile doc itself — orders/reviews/payouts elsewhere may still
    // reference this uid, and a missing users/{uid} doc would turn every one of those into a
    // dangling reference instead of a clearly-labeled deleted account.
    await db.collection('users').doc(uid).update({
      full_name: 'Deleted User',
      email: `deleted-${uid}@dressmart.invalid`,
      phone: null,
      avatar_url: null,
      fcm_tokens: [],
      updated_at: now,
    });

    await auth.deleteUser(uid);

    return { success: true };
  }),
);
