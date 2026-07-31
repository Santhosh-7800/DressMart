import { Capacitor } from '@capacitor/core';

/**
 * Native Android push-notification scaffolding — installed and wired, but deliberately inert until
 * a real Firebase project's `google-services.json` is added to `android/app/`. Without it, the
 * native FCM SDK has no project to register against, so `PushNotifications.register()` will fail;
 * every step below is wrapped so that failure is a silent, expected no-op rather than a crash.
 *
 * TODO(production): once android/app/google-services.json exists (see README's "Push Notification
 * Setup" section):
 *   1. This function will start actually registering devices and receiving tokens — nothing here
 *      needs to change.
 *   2. Wire `onRegistration`'s token into a Firestore write (e.g. `users/{uid}.fcmTokens`) so
 *      Cloud Functions can target this device — there's deliberately no Firestore write here yet,
 *      since without a real project there's nowhere legitimate to send it.
 *   3. Add a server-side Cloud Function (functions/src/triggers or callables) that reads those
 *      tokens and calls `admin.messaging().send(...)` — out of scope for this client-side prep.
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
    // TODO(production): persist token.value to this user's Firestore profile once there's a real
    // project to send pushes from — see this file's docstring.
    console.info('[pushNotifications] device registered, token:', token.value);
  });

  PushNotifications.addListener('registrationError', (error) => {
    console.warn('[pushNotifications] registration error:', error.error);
  });

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.info('[pushNotifications] received while foregrounded:', notification);
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    // TODO(production): route to the relevant in-app screen based on the notification payload
    // (e.g. an order-update push should open /orders/{orderId}) — mirror DeepLinkListener's
    // pattern (src/routes/AppRoutes.tsx) once real push payloads exist to design the mapping from.
    console.info('[pushNotifications] tapped:', action.notification);
  });
}
