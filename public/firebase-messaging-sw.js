// Firebase Cloud Messaging background service worker.
//
// CONFIG APPROACH (documented, not incidental): this file is served as-is from /public — Vite does
// not process it, so it has no access to import.meta.env / VITE_* build-time variables the way
// src/lib/firebase.ts does. Two options exist to get Firebase config into it: (a) hardcode the
// config object directly here, or (b) fetch a small generated /firebase-config.json at runtime.
// We picked (a): Firebase's web config values are not secrets — they only identify *which*
// Firebase project to talk to, and access is enforced by Firestore/Storage security rules (see
// firestore.rules / storage.rules), not by hiding this object. Hardcoding avoids an extra runtime
// network request (and its failure mode: push silently not working if that fetch 404s) and needs
// no extra build tooling — it's the same pattern Firebase's own docs use for this exact file.
//
// ACTION REQUIRED before shipping push notifications to production: replace the placeholder values
// below with this project's real Firebase config (Firebase Console > Project Settings > General >
// Your apps > Web app > SDK setup and configuration) — the same values that populate
// VITE_FIREBASE_* in your .env file (see src/lib/env.ts / src/lib/firebase.ts).
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'REPLACE_WITH_VITE_FIREBASE_API_KEY',
  authDomain: 'REPLACE_WITH_VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'REPLACE_WITH_VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'REPLACE_WITH_VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'REPLACE_WITH_VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'REPLACE_WITH_VITE_FIREBASE_APP_ID',
});

const messaging = firebase.messaging();

// Handles pushes that arrive while no DressMart tab has focus. Foreground pushes (a tab is open and
// focused) are received in-app instead via onMessage, not here — see useFcmToken's caller for that
// wiring if/when an in-app toast-on-foreground-push is added.
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'DressMart', {
    body: body || '',
    icon: icon || '/favicon.svg',
    data: payload.data || {},
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data && event.notification.data.link;
  if (link) {
    event.waitUntil(clients.openWindow(link));
  }
});
