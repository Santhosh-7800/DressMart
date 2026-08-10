import { Capacitor } from '@capacitor/core';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
} from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { isSupported, type Messaging } from 'firebase/messaging';
import { env } from './env';

// Firebase Authentication always talks to the real Firebase project — it never connects to a local
// emulator, in any environment, so signInWithPopup() always opens Google's real accounts.google.com
// account chooser instead of the emulator's mock consent screen. Real VITE_FIREBASE_API_KEY /
// VITE_FIREBASE_PROJECT_ID are therefore required unconditionally; main.tsx's bootstrap() catches
// this throw and shows a generic, user-friendly message instead of a blank page.
if (!(env.firebase.apiKey && env.firebase.projectId)) {
  throw new Error(
    'Firebase is misconfigured: VITE_FIREBASE_API_KEY / VITE_FIREBASE_PROJECT_ID are missing. ' +
      'Firebase Authentication requires real project credentials in every environment (see ' +
      '.env.example) — Firestore/Storage/Functions may still use the local emulator via ' +
      'VITE_USE_FIREBASE_EMULATOR=true, but Authentication does not.',
  );
}

// Hard stop for the exact misconfiguration that silently resets every customer's cart/orders/
// profile in production: VITE_USE_FIREBASE_EMULATOR=true leaking into a deployed build (e.g. left
// on in a hosting provider's env vars). A real visitor's browser can't reach `localhost:8081` —
// every Firestore/Storage/Functions call would fail against a project that doesn't actually exist
// for them, while Auth (always real, see above) keeps working, which is exactly what makes this
// look like "the account has no data" instead of an obvious outage. Fail loudly at boot instead.
if (import.meta.env.PROD && env.useEmulators) {
  throw new Error(
    'Firebase is misconfigured: VITE_USE_FIREBASE_EMULATOR=true in a production build. ' +
      'Remove that env var (or set it to false) in your hosting provider’s configuration — a ' +
      'deployed app must never point Firestore/Storage/Functions at a local emulator.',
  );
}

const app = initializeApp({
  apiKey: env.firebase.apiKey,
  authDomain: env.firebase.authDomain,
  projectId: env.firebase.projectId,
  // The 'demo-*' fallbacks below are ONLY ever used when actually talking to the local Firestore/
  // Storage/Functions emulators (env.useEmulators — see env.ts) — the emulator doesn't validate
  // these, so any value works. Authentication (above) never takes this fallback path.
  storageBucket: env.firebase.storageBucket || (env.useEmulators ? 'demo-dressmart.appspot.com' : ''),
  messagingSenderId: env.firebase.messagingSenderId || (env.useEmulators ? '0' : ''),
  appId: env.firebase.appId || (env.useEmulators ? 'demo-app-id' : ''),
});

/** Always the real Firebase project — Authentication never connects to a local emulator. */
export const auth = getAuth(app);
/**
 * Offline persistence via IndexedDB, shared across tabs — browsing cached products/cart/orders
 * keeps working offline, and writes queue up and sync automatically once connectivity returns.
 * Must be set at Firestore creation time (initializeFirestore), not after getFirestore().
 *
 * Deliberately NOT used against the emulator: IndexedDB persists in the browser across emulator
 * restarts, but the local emulator's own data does not (it's recreated from scratch every time it
 * restarts in this dev setup). A stale persistent cache pointed at a since-wiped-and-reseeded
 * emulator is exactly what triggers the Firestore SDK's "INTERNAL ASSERTION FAILED: Unexpected
 * state" crash — the watch-stream state machine can't reconcile old cached resume tokens/documents
 * against a completely different server dataset. Plain in-memory cache resets on every page load,
 * so it never accumulates that kind of stale state. Real production users keep full persistence.
 */
export const db = initializeFirestore(app, {
  localCache: env.useEmulators ? memoryLocalCache() : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const storage = getStorage(app);
export const functions = getFunctions(app);

if (env.useEmulators) {
  // 10.0.2.2 is the standard Android Emulator's alias for the host machine's localhost (AVD-only —
  // a real physical device would need the host's actual LAN IP instead). Only matters for local
  // dev/testing against the emulator suite from inside the native Android shell; production builds
  // point at a real Firebase project and never take this branch at all.
  //
  // Authentication is deliberately absent here — it always uses the real Firebase project (see the
  // guard + `auth` above), regardless of VITE_USE_FIREBASE_EMULATOR.
  const emulatorHost = Capacitor.isNativePlatform() ? '10.0.2.2' : 'localhost';
  connectFirestoreEmulator(db, emulatorHost, 8081);
  connectStorageEmulator(storage, emulatorHost, 9199);
  connectFunctionsEmulator(functions, emulatorHost, 5001);
}

if (import.meta.env.DEV) {
  console.info(
    env.useEmulators
      ? `[firebase] Authentication → live Firebase project "${env.firebase.projectId}". Firestore/Storage/Functions → local emulators (:8081/:9199/:5001).`
      : `[firebase] Using live Firebase project "${env.firebase.projectId}".`,
  );
}

/** Lazily resolved — FCM requires browser support (no SSR, needs a service worker) and is unavailable in most emulator/test contexts. */
export async function getMessagingIfSupported(): Promise<Messaging | null> {
  if (!(await isSupported())) return null;
  const { getMessaging } = await import('firebase/messaging');
  return getMessaging(app);
}

export { app };
