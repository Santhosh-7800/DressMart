import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from '../lib/admin';
import { runCallable } from '../lib/callableGuard';
import type { Profile } from '../lib/types';

interface BroadcastPromotionalNotificationData {
  title: string;
  message: string;
  link?: string;
}

const MAX_TITLE_LENGTH = 80;
const MAX_MESSAGE_LENGTH = 200;
const BATCH_CHUNK_SIZE = 400; // stay comfortably under Firestore's 500-write batch limit

/**
 * Admin-only: fans a single promotional notification out to every buyer account. This is
 * the one case where a notification is created for a user OTHER than the caller, so it must go
 * through a Cloud Function — firestore.rules' `notifications/{id}` create rule only allows a user
 * to create a notification for their OWN uid, exactly to prevent one account from writing into
 * another's notification feed. No dedup/rate-limit beyond "the Admin decided to send this
 * right now" — Section 19's "avoid excessive notifications" is satisfied by this being a
 * deliberate, one-at-a-time manual action rather than an automated trigger, not by inventing a
 * cooldown the business never asked for.
 */
export const broadcastPromotionalNotification = onCall<BroadcastPromotionalNotificationData>(async (request) =>
  runCallable('Could not send this notification. Please try again.', async () => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in.');
    }
    const { title, message, link } = request.data ?? ({} as BroadcastPromotionalNotificationData);
    if (!title?.trim() || !message?.trim()) {
      throw new HttpsError('invalid-argument', 'title and message are required.');
    }
    if (title.length > MAX_TITLE_LENGTH || message.length > MAX_MESSAGE_LENGTH) {
      throw new HttpsError('invalid-argument', `title must be ${MAX_TITLE_LENGTH} characters or fewer, message ${MAX_MESSAGE_LENGTH}.`);
    }

    const callerSnap = await db.collection('users').doc(request.auth.uid).get();
    const caller = callerSnap.data() as Profile | undefined;
    if (!caller || caller.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Only the Admin can send promotional notifications.');
    }

    const buyersSnap = await db.collection('users').where('role', '==', 'buyer').get();
    const nowIso = new Date().toISOString();
    const docs = buyersSnap.docs;
    for (let i = 0; i < docs.length; i += BATCH_CHUNK_SIZE) {
      const batch = db.batch();
      for (const buyerDoc of docs.slice(i, i + BATCH_CHUNK_SIZE)) {
        batch.set(db.collection('notifications').doc(), {
          user_id: buyerDoc.id,
          title: title.trim(),
          message: message.trim(),
          type: 'promotion',
          is_read: false,
          link: link?.trim() || null,
          created_at: nowIso,
        });
      }
      await batch.commit();
    }

    return { success: true, recipientCount: docs.length };
  }),
);
