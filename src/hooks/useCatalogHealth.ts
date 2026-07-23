import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, limit as fsLimit, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { env } from '@/lib/env';

export type CatalogHealthStatus = 'checking' | 'ok' | 'empty' | 'offline';

/**
 * One-time, app-boot check that the `products` collection actually has data — not a per-page
 * concern, just enough to distinguish "genuinely offline/unreachable" from "connected but empty"
 * (e.g. a local Firestore emulator that lost its data before exporting) so the app can show a
 * clear, actionable message instead of silently rendering empty product grids everywhere.
 *
 * Deliberately does NOT retry automatically forever — `retry()` is user-triggered (a button), so a
 * flaky/slow first check never traps the user in a loading state.
 */
export function useCatalogHealth() {
  const [status, setStatus] = useState<CatalogHealthStatus>('checking');

  const check = useCallback(async () => {
    setStatus('checking');
    try {
      const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 6000));
      const checkProducts = async (): Promise<'empty' | 'ok'> => {
        const snap = await getDocs(query(collection(db, 'products'), fsLimit(1)));
        return snap.empty ? 'empty' : 'ok';
      };
      const result = await Promise.race([checkProducts(), timeout]);
      setStatus(result === 'timeout' ? 'offline' : result);
    } catch {
      setStatus('offline');
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  return { status, retry: check, isEmulator: env.useEmulators };
}
