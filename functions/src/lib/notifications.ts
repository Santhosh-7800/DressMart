import { db } from './admin';
import type { NotificationType } from './types';

interface CreateNotificationArgs {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  link?: string | null;
}

/**
 * Writes a `notifications/{autoId}` doc. `onNotificationCreated` (Firestore trigger) picks this up
 * and fans it out to FCM — callers here don't need to touch push notifications directly.
 */
export async function createNotification(args: CreateNotificationArgs): Promise<void> {
  await db.collection('notifications').add({
    user_id: args.userId,
    title: args.title,
    message: args.message,
    type: args.type,
    is_read: false,
    link: args.link ?? null,
    created_at: new Date().toISOString(),
  });
}
