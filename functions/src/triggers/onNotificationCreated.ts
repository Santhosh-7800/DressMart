import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { db, messaging } from '../lib/admin';
import type { Notification } from '../lib/types';

/**
 * Fans a newly-created `notifications/{id}` doc out to FCM, using the user's registered
 * `users/{uid}.fcm_tokens`. Errors here are logged, never thrown — a failed push must not fail
 * the Firestore write that already succeeded, and shouldn't retry-loop the function.
 */
export const onNotificationCreated = onDocumentCreated('notifications/{notificationId}', async (event) => {
  const notification = event.data?.data() as Notification | undefined;
  if (!notification) return;

  try {
    const userSnap = await db.collection('users').doc(notification.user_id).get();
    const tokens = (userSnap.data()?.fcm_tokens as string[] | undefined) ?? [];
    if (tokens.length === 0) return;

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: notification.title,
        body: notification.message,
      },
      data: {
        link: notification.link ?? '',
        type: notification.type,
      },
    });

    const staleTokens: string[] = [];
    response.responses.forEach((r, i) => {
      if (!r.success && r.error?.code === 'messaging/registration-token-not-registered') {
        staleTokens.push(tokens[i]);
      }
    });
    if (staleTokens.length > 0) {
      const remaining = tokens.filter((t) => !staleTokens.includes(t));
      await db.collection('users').doc(notification.user_id).update({ fcm_tokens: remaining });
    }
  } catch (err) {
    console.error('onNotificationCreated: failed to send FCM push', err);
  }
});
