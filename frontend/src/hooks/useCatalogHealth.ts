import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, getDocs, limit as fsLimit, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { env } from '@/lib/env';
import { primeCatalogCaches } from '@/services/productService';

export type CatalogHealthStatus = 'checking' | 'ok' | 'empty' | 'offline';

type ProbeResult = 'ok' | 'empty' | 'timeout';

/** Response body from scripts/vite/devSeedPlugin.ts's dev-only endpoint. */
interface DevReseedResponse {
  outcome: 'already-seeded' | 'seeded' | 'unreachable' | 'error';
}

const CHECK_TIMEOUT_MS = 6000;
/** Bounded backoff so a slow-to-warm-up connection doesn't immediately show an error screen. */
const RETRY_DELAYS_MS = [1000, 2000, 4000];

async function probeProductsCollection(): Promise<ProbeResult> {
  const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), CHECK_TIMEOUT_MS));
  const check = getDocs(query(collection(db, 'products'), fsLimit(1)))
    .then((snap): ProbeResult => (snap.empty ? 'empty' : 'ok'))
    .catch((): ProbeResult => 'timeout');
  return Promise.race([check, timeout]);
}

/**
 * Dev-only self-heal: ask the Vite dev server to re-run the seed-if-empty check (see
 * scripts/vite/devSeedPlugin.ts) instead of making the user run a script by hand. `import.meta.env.DEV`
 * is inlined to `false` in production builds, so this whole path — and the fetch call — is
 * dead-code-eliminated from the bundle Play Store ships.
 */
async function triggerDevReseed(): Promise<boolean> {
  if (!import.meta.env.DEV) return false;
  try {
    const res = await fetch('/__dev/ensure-seeded', { method: 'POST' });
    const body = (await res.json()) as DevReseedResponse;
    return body.outcome === 'seeded' || body.outcome === 'already-seeded';
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[useCatalogHealth] dev reseed request failed:', error);
    return false;
  }
}

/**
 * One-time, app-boot check that the `products` collection actually has data — not a per-page
 * concern, just enough to distinguish "genuinely offline/unreachable" from "connected but empty"
 * (e.g. a local Firestore emulator that lost its data before it could export) so the app can show a
 * clear, actionable message instead of silently rendering empty product grids everywhere.
 *
 * Retries with backoff, and — in dev, against the emulator — automatically triggers a reseed before
 * ever surfacing "empty" to the UI. `retry()` is still exposed as a user-triggered fallback for the
 * rare case that didn't resolve it (e.g. the emulator itself is down, not just its data).
 */
export function useCatalogHealth() {
  const [status, setStatus] = useState<CatalogHealthStatus>('checking');
  const runningRef = useRef(false);

  const check = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setStatus('checking');
    try {
      let result: ProbeResult = 'timeout';
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        result = await probeProductsCollection();

        if (result === 'ok') break;

        if (result === 'empty' && env.useEmulators) {
          const healed = await triggerDevReseed();
          if (healed) {
            primeCatalogCaches();
            result = await probeProductsCollection();
            if (result === 'ok') break;
          }
        }

        if (attempt < RETRY_DELAYS_MS.length) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
        }
      }
      setStatus(result === 'timeout' ? 'offline' : result);
    } finally {
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  return { status, retry: check, isEmulator: env.useEmulators };
}
