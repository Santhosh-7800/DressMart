const firebaseApiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;

const hasRealCredentials = Boolean(
  firebaseApiKey && firebaseProjectId && !firebaseApiKey.includes('your-') && !firebaseProjectId.includes('your-'),
);

/**
 * `VITE_USE_FIREBASE_EMULATOR=true` always wins (explicit, intentional). Otherwise: a local dev
 * server (`npm run dev`, `import.meta.env.DEV`) may fall back to the emulator when no real project
 * is configured, purely so a fresh contributor checkout works before anyone has filled in `.env` —
 * see firebase.ts.
 *
 * A PRODUCTION build (`vite build` — every deployed target: Vercel, Firebase Hosting, GitHub Pages,
 * the Capacitor Android shell) must NEVER take that same fallback, because there is no local
 * emulator reachable from a real visitor's browser or device. Missing/placeholder credentials in a
 * production build are a deployment misconfiguration (env vars not set on the host), not something
 * to silently paper over by mimicking a broken local dev setup — see firebase.ts's hard failure for
 * exactly that case, and its docstring for why it deliberately does NOT reference this constant.
 */
const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true' || (import.meta.env.DEV && !hasRealCredentials);

export const env = {
  firebase: {
    apiKey: firebaseApiKey ?? '',
    authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) ?? '',
    projectId: firebaseProjectId ?? '',
    storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined) ?? '',
    messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined) ?? '',
    appId: (import.meta.env.VITE_FIREBASE_APP_ID as string | undefined) ?? '',
  },
  /** VAPID key for requesting an FCM push token in the browser (Project Settings > Cloud Messaging > Web Push certificates). */
  fcmVapidKey: (import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined) ?? '',
  razorpayKeyId: (import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined) ?? '',
  /** The Firebase project's auto-generated "Web application" OAuth client (client_type: 3 in
   *  google-services.json) — required by the native Google Sign-In flow (authService.ts) on
   *  Android, which needs this to mint a Firebase-compatible ID token even though the app itself
   *  is native, not web. Not a secret (it's already public inside the committed google-services.json);
   *  the fallback is that exact value, so this only needs overriding if the Firebase project changes. */
  googleWebClientId:
    (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined) ?? '546968393276-ctmu07249crbestk4op0lgee7c14pd9s.apps.googleusercontent.com',
  siteUrl: (import.meta.env.VITE_SITE_URL as string | undefined) ?? 'http://localhost:5173',
  useEmulators,
  /** Overrides firebase.ts's native-platform emulator host (10.0.2.2, AVD-only) — set to 'localhost' when testing on a real device over `adb reverse`. */
  emulatorHost: import.meta.env.VITE_EMULATOR_HOST as string | undefined,
};
