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

/**
 * Same as createNotification, but guarded against Cloud Functions' at-least-once trigger delivery:
 * if this exact `lockKey` was already used, the notification is skipped instead of being sent
 * again. Firestore document-update triggers (onOrderStatusChange/onReturnStatusChange/
 * onExchangeStatusChange) guard their status-transition logic with `before.status ===
 * after.status`, but that check alone doesn't protect against the platform redelivering the SAME
 * event — a redelivery has identical before/after values, so the transition check still passes.
 * `lockKey` should be deterministic per (document, target status), e.g. `order:${orderId}:${status}`.
 */
export async function createNotificationOnce(lockKey: string, args: CreateNotificationArgs): Promise<void> {
  const lockRef = db.collection('notification_locks').doc(lockKey);
  const alreadySent = await db.runTransaction(async (tx) => {
    const snap = await tx.get(lockRef);
    if (snap.exists) return true;
    tx.set(lockRef, { created_at: new Date().toISOString() });
    return false;
  });
  if (alreadySent) return;
  await createNotification(args);
}
