import { useCallback, useEffect, useState } from 'react';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db, getMessagingIfSupported } from '@/lib/firebase';
import { env } from '@/lib/env';
import { useAuth } from '@/contexts/AuthContext';

type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

/**
 * Web Push (FCM) opt-in — call `enablePush()` from a Settings/Notifications toggle. Requests
 * browser notification permission, registers `public/firebase-messaging-sw.js`, mints a token via
 * `getToken`, and appends it to `users/{uid}.fcm_tokens` (arrayUnion — safe even if the field
 * doesn't exist yet, and safe to call again from a second browser/device without clobbering the
 * first token).
 */
export function useFcmToken() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<PushPermission>(() =>
    typeof Notification === 'undefined' ? 'unsupported' : (Notification.permission as PushPermission),
  );
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPermission(Notification.permission as PushPermission);
  }, []);

  const enablePush = useCallback(async () => {
    if (!user) {
      toast.error('Sign in to enable push notifications.');
      return;
    }
    if (typeof window === 'undefined' || typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
      setPermission('unsupported');
      toast.error('Push notifications aren\'t supported in this browser.');
      return;
    }

    setIsRegistering(true);
    try {
      const requestedPermission = await Notification.requestPermission();
      setPermission(requestedPermission as PushPermission);
      if (requestedPermission !== 'granted') {
        toast.error('Notification permission was not granted.');
        return;
      }

      const messaging = await getMessagingIfSupported();
      if (!messaging) {
        setPermission('unsupported');
        toast.error('Push notifications aren\'t supported in this browser.');
        return;
      }

      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const { getToken } = await import('firebase/messaging');
      const token = await getToken(messaging, { vapidKey: env.fcmVapidKey, serviceWorkerRegistration: registration });
      if (!token) {
        toast.error('Could not get a push token — try again.');
        return;
      }

      // arrayUnion creates the `fcm_tokens` field if it doesn't exist yet, and de-dupes if this
      // exact token is somehow registered twice — no need to read the doc first.
      await updateDoc(doc(db, 'users', user.id), { fcm_tokens: arrayUnion(token) });
      toast.success('Push notifications enabled');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not enable push notifications');
    } finally {
      setIsRegistering(false);
    }
  }, [user]);

  return { permission, enablePush, isRegistering, isSupported: permission !== 'unsupported' };
}
