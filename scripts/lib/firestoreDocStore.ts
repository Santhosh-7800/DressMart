/**
 * Shared Firestore read/write helper for the curated seed scripts (seedCuratedFormalShirts,
 * seedCuratedShirtsTshirts, seedCuratedApparel, seedCuratedKids) — dual-mode, so the exact same
 * script and CLI invocation works against both targets:
 *
 *  - Local emulator (FIRESTORE_EMULATOR_HOST set): talks to the Firestore REST API directly with
 *    the emulator's universally-accepted `Bearer owner` token. This bypasses firebase-admin's gRPC
 *    client, which has proven unreliable against the *local* emulator in this dev environment —
 *    REST has been the reliably-working path here (see git history for the original rationale).
 *  - Real project (FIRESTORE_EMULATOR_HOST unset): uses firebase-admin's Firestore client (the same
 *    `db` scripts/seedFirestore.ts already exports and initializes) — Google's own supported SDK
 *    for talking to a real project, which doesn't have the emulator-specific gRPC flakiness and
 *    already has proper Application Default Credentials resolution built in (a hand-rolled REST
 *    client would need to replicate that token minting itself, for no benefit).
 *
 * Before this module existed, all four curated scripts hardcoded the REST-only path and hardcoded
 * `Bearer owner` — real, production Firestore rejects that token, so `npm run seed:curated-*` could
 * never actually seed a real project, only the local emulator. Every curated script should import
 * `docGet`/`docSet` from here instead of rolling its own REST client.
 */
import { db as adminDb } from '../seedFirestore.js';

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'demo-dressmart';

// --- Firestore REST helpers (emulator-only path) -------------------------------------------------
function toFirestoreValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === 'object') return { mapValue: { fields: toFirestoreFields(value as Record<string, unknown>) } };
  throw new Error(`Unsupported value type for Firestore REST write: ${typeof value}`);
}

function toFirestoreFields(obj: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    fields[key] = toFirestoreValue(value);
  }
  return fields;
}

function fromFirestoreValue(value: Record<string, unknown>): unknown {
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('arrayValue' in value) {
    const arr = (value.arrayValue as { values?: Record<string, unknown>[] }).values ?? [];
    return arr.map(fromFirestoreValue);
  }
  if ('mapValue' in value) {
    return fromFirestoreFields((value.mapValue as { fields?: Record<string, Record<string, unknown>> }).fields ?? {});
  }
  return null;
}

function fromFirestoreFields(fields: Record<string, Record<string, unknown>>): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) obj[key] = fromFirestoreValue(value);
  return obj;
}

function docUrl(collection: string, docId: string): string {
  return `http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 8, timeoutMs = 10_000): Promise<Response> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (res.status >= 500 || res.status === 409) {
        if (attempt === attempts) return res;
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        continue;
      }
      return res;
    } catch (error) {
      clearTimeout(timer);
      if (attempt === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw new Error(`unreachable: fetchWithRetry exhausted attempts for ${url}`);
}

async function restGet(collection: string, docId: string): Promise<Record<string, unknown> | null> {
  const res = await fetchWithRetry(docUrl(collection, docId), { headers: { Authorization: 'Bearer owner' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`REST read failed for ${collection}/${docId}: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { fields?: Record<string, Record<string, unknown>> };
  return fromFirestoreFields(json.fields ?? {});
}

async function restSet(collection: string, docId: string, data: Record<string, unknown>): Promise<void> {
  const res = await fetchWithRetry(docUrl(collection, docId), {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) throw new Error(`REST write failed for ${collection}/${docId}: ${res.status} ${await res.text()}`);
}

/** Reads a document. Returns `null` if it doesn't exist yet (a fresh insert, not an update). */
export async function docGet(collection: string, docId: string): Promise<Record<string, unknown> | null> {
  if (EMULATOR_HOST) return restGet(collection, docId);
  const snap = await adminDb.collection(collection).doc(docId).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : null;
}

/** Upserts a document (merge semantics — an existing doc's other fields, if any, are preserved). */
export async function docSet(collection: string, docId: string, data: Record<string, unknown>): Promise<void> {
  if (EMULATOR_HOST) return restSet(collection, docId, data);
  await adminDb.collection(collection).doc(docId).set(data, { merge: true });
}
