import { Capacitor } from '@capacitor/core';
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { DEEP_LINK_EVENT } from './deepLinks';

/**
 * Native Android push-notification scaffolding. `android/app/google-services.json` now points at a
 * real Firebase project, so this actually registers devices and receives tokens (still wrapped so a
 * misconfiguration is a silent, expected no-op rather than a startup crash). The registered token is
 * persisted the same way `useFcmToken.ts` (web push) does — `users/{uid}.fcm_tokens` via `arrayUnion`
 * — so `onNotificationCreated`'s Cloud Function trigger can target this device.
 */
export async function initPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const { PushNotifications } = await import('@capacitor/push-notifications');

  try {
    // Android 8+ requires every notification to belong to a channel — without one, Android
    // silently drops the notification rather than showing it with a default channel.
    await PushNotifications.createChannel({
      id: 'default',
      name: 'General',
      description: 'Order updates, offers, and account alerts',
      importance: 4, // IMPORTANCE_HIGH — heads-up notification, matches a shopping app's order alerts
      visibility: 1, // VISIBILITY_PUBLIC
    });

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') return;

    await PushNotifications.register();
  } catch (error) {
    // Expected until google-services.json is added — the native FCM SDK has no project to
    // register against yet. Logged (not thrown) so it never blocks app startup.
    console.info('[pushNotifications] registration skipped — Firebase project not yet configured for this platform.', error);
    return;
  }

  PushNotifications.addListener('registration', (token) => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      // Registration can fire before sign-in completes (e.g. a cold start on the login screen) —
      // there's no user to attach the token to yet. Not treated as an error: once the user does sign
      // in and enables push from Settings, useFcmToken.ts's web-push path writes to the same
      // fcm_tokens field, so the device still ends up registered.
      console.info('[pushNotifications] device registered before sign-in — token not yet persisted.');
      return;
    }
    // Phase 19: the native SDK fires 'registration' on every app process/cold start even when the
    // token itself hasn't changed, which previously meant an unconditional Firestore write on every
    // launch. `arrayUnion` already de-dupes server-side (this was never a correctness bug), but
    // skipping the write client-side when the token matches what THIS device last persisted avoids
    // a redundant write on every single app open.
    const lastPersistedKey = `dressmart_fcm_token_${uid}`;
    if (localStorage.getItem(lastPersistedKey) === token.value) return;
    updateDoc(doc(db, 'users', uid), { fcm_tokens: arrayUnion(token.value) })
      .then(() => localStorage.setItem(lastPersistedKey, token.value))
      .catch((error) => {
        console.warn('[pushNotifications] failed to persist device token:', error);
      });
  });

  PushNotifications.addListener('registrationError', (error) => {
    console.warn('[pushNotifications] registration error:', error.error);
  });

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.info('[pushNotifications] received while foregrounded:', notification);
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    // Phase 22: was a no-op TODO — onNotificationCreated.ts already sends the notification's own
    // `link` field (an in-app route like `/orders/{orderId}`, already exactly what NotificationsPage
    // itself links to) as part of the FCM data payload, so no new resolution logic is needed here —
    // just dispatch it through the SAME DEEP_LINK_EVENT bridge `appUrlOpen` already uses (handled by
    // AppRoutes.tsx's useDeepLinkNavigation, which calls navigate() with whatever path it receives).
    const link = action.notification.data?.link as string | undefined;
    if (link) window.dispatchEvent(new CustomEvent(DEEP_LINK_EVENT, { detail: link }));
  });
}
