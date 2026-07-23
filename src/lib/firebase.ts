import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { isSupported, type Messaging } from 'firebase/messaging';
import { env } from './env';

const app = initializeApp({
  apiKey: env.firebase.apiKey || 'demo-api-key',
  authDomain: env.firebase.authDomain || 'demo.firebaseapp.com',
  projectId: env.firebase.projectId || 'demo-dressmart',
  storageBucket: env.firebase.storageBucket || 'demo-dressmart.appspot.com',
  messagingSenderId: env.firebase.messagingSenderId || '0',
  appId: env.firebase.appId || 'demo-app-id',
});

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

if (env.useEmulators) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8081);
  connectStorageEmulator(storage, 'localhost', 9199);
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

/** Lazily resolved — FCM requires browser support (no SSR, needs a service worker) and is unavailable in most emulator/test contexts. */
export async function getMessagingIfSupported(): Promise<Messaging | null> {
  if (!(await isSupported())) return null;
  const { getMessaging } = await import('firebase/messaging');
  return getMessaging(app);
}

export { app };
