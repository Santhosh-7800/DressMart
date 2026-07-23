const firebaseApiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;

const hasRealCredentials = Boolean(
  firebaseApiKey && firebaseProjectId && !firebaseApiKey.includes('your-') && !firebaseProjectId.includes('your-'),
);

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
  siteUrl: (import.meta.env.VITE_SITE_URL as string | undefined) ?? 'http://localhost:5173',
  /** True unless a real Firebase project is configured in `.env` — see firebase.ts, which then talks to the local Firebase emulators instead. */
  useEmulators: import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true' || !hasRealCredentials,
};
