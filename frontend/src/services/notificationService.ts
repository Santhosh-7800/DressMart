import { collection, addDoc, doc, getDocs, onSnapshot, orderBy, query, updateDoc, where, writeBatch, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Notification, NotificationType } from '@/types';

const NOTIFICATIONS_COLLECTION = 'notifications';

export const notificationService = {
  /** Available for any client-triggered notification (e.g. a seller action the buyer should hear
   *  about immediately). Most system notifications (new_order, low_stock, seller_registration, ...)
   *  are better raised from a Cloud Function running with the Admin SDK — see functions/src — since
   *  that's the only place that can write into another user's `notifications` the rules don't
   *  already allow from the client for cross-user cases beyond what `allow create: if isSignedIn()` covers. */
  async create(userId: string, input: Pick<Notification, 'title' | 'message' | 'type' | 'link'>): Promise<void> {
    await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
      user_id: userId,
      is_read: false,
      created_at: new Date().toISOString(),
      ...input,
    });
  },

  async list(userId: string): Promise<Notification[]> {
    const snap = await getDocs(
      query(collection(db, NOTIFICATIONS_COLLECTION), where('user_id', '==', userId), orderBy('created_at', 'desc')),
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Notification);
  },

  /** Realtime — a single user's own notifications is naturally small/bounded, unlike a whole-collection
   *  aggregate, so a live listener here (unlike e.g. platform-wide revenue) is cheap and exactly what
   *  "unread badge updates the instant a notification lands" needs. */
  subscribe(userId: string, callback: (notifications: Notification[]) => void): Unsubscribe {
    const q = query(collection(db, NOTIFICATIONS_COLLECTION), where('user_id', '==', userId), orderBy('created_at', 'desc'));
    return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Notification)));
  },

  async markRead(userId: string, notificationId: string): Promise<Notification[]> {
    await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId), { is_read: true });
    return this.list(userId);
  },

  async markAllRead(userId: string): Promise<Notification[]> {
    const snap = await getDocs(
      query(collection(db, NOTIFICATIONS_COLLECTION), where('user_id', '==', userId), where('is_read', '==', false)),
    );
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.update(d.ref, { is_read: true }));
      await batch.commit();
    }
    return this.list(userId);
  },
};

export type { NotificationType };
