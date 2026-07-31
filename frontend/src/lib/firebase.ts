import { Capacitor } from '@capacitor/core';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
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

// The 'demo-*' values below are ONLY ever used when actually talking to the local Firebase
// emulator suite (env.useEmulators — see env.ts) — the emulator doesn't validate credentials, so
// any project id works, and 'demo-dressmart' matches this project's emulator data/scripts. This
// fallback is deliberately NOT reachable in a real production build: if VITE_USE_FIREBASE_EMULATOR
// isn't 'true', env.useEmulators is only true when real VITE_FIREBASE_* credentials are missing —
// which is itself a build misconfiguration, so we fail loudly here instead of silently shipping a
// bundle that talks to a nonexistent 'demo-dressmart' project or (worse) to no project at all.
if (!env.useEmulators && !(env.firebase.apiKey && env.firebase.projectId)) {
  throw new Error(
    'Firebase is misconfigured: VITE_FIREBASE_API_KEY / VITE_FIREBASE_PROJECT_ID are missing and ' +
      'VITE_USE_FIREBASE_EMULATOR is not "true". Set real Firebase project credentials in your ' +
      'environment (see .env.example) before building for production.',
  );
}

const app = initializeApp({
  apiKey: env.firebase.apiKey || (env.useEmulators ? 'demo-api-key' : ''),
  authDomain: env.firebase.authDomain || (env.useEmulators ? 'demo.firebaseapp.com' : ''),
  projectId: env.firebase.projectId || (env.useEmulators ? 'demo-dressmart' : ''),
  storageBucket: env.firebase.storageBucket || (env.useEmulators ? 'demo-dressmart.appspot.com' : ''),
  messagingSenderId: env.firebase.messagingSenderId || (env.useEmulators ? '0' : ''),
  appId: env.firebase.appId || (env.useEmulators ? 'demo-app-id' : ''),
});

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
  const emulatorHost = Capacitor.isNativePlatform() ? '10.0.2.2' : 'localhost';
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost, 8081);
  connectStorageEmulator(storage, emulatorHost, 9199);
  connectFunctionsEmulator(functions, emulatorHost, 5001);
}

/** Lazily resolved — FCM requires browser support (no SSR, needs a service worker) and is unavailable in most emulator/test contexts. */
export async function getMessagingIfSupported(): Promise<Messaging | null> {
  if (!(await isSupported())) return null;
  const { getMessaging } = await import('firebase/messaging');
  return getMessaging(app);
}

export { app };
