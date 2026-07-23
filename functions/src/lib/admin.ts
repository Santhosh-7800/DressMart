/**
 * Single Admin SDK app instance shared across every callable/trigger in this codebase.
 * Cloud Functions supplies default credentials automatically (both in the emulator, via
 * FIRESTORE_EMULATOR_HOST/FIREBASE_AUTH_EMULATOR_HOST env vars set by `firebase emulators:start`,
 * and in production, via the function's runtime service account) — no explicit config needed.
 */
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

if (!getApps().length) {
  initializeApp();
}

export const db = getFirestore();
export const messaging = getMessaging();
