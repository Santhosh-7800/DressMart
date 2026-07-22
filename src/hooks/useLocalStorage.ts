import { useCallback, useSyncExternalStore } from 'react';

type Updater<T> = T | ((prev: T) => T);

/**
 * Per-key subscriber lists and a last-raw-string/parsed-value cache, so getSnapshot only produces
 * a new object reference when the underlying localStorage string actually changed (required by
 * useSyncExternalStore — returning a freshly-parsed object every call would loop forever).
 */
const listeners = new Map<string, Set<() => void>>();
const cache = new Map<string, { raw: string | null; parsed: unknown }>();

function getListeners(key: string): Set<() => void> {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  return set;
}

function readRaw(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function getSnapshot<T>(key: string, initialValue: T): T {
  const raw = readRaw(key);
  const cached = cache.get(key);
  if (cached && cached.raw === raw) return cached.parsed as T;
  let parsed: T;
  try {
    parsed = raw !== null ? (JSON.parse(raw) as T) : initialValue;
  } catch {
    parsed = initialValue;
  }
  cache.set(key, { raw, parsed });
  return parsed;
}

/**
 * Shared, cross-component-synced localStorage state. Plain useState-per-instance would let two
 * components pointing at the same key (e.g. the navbar's pincode display and the delivery-address
 * dropdown that writes it) drift out of sync — the writer's localStorage.setItem never causes the
 * reader's own React state to update, since nothing tells it to re-check. useSyncExternalStore plus
 * a small pub/sub here means every instance watching a key re-renders the moment any instance writes it.
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: Updater<T>) => void] {
  const subscribe = useCallback(
    (callback: () => void) => {
      const set = getListeners(key);
      set.add(callback);
      const handleStorage = (e: StorageEvent) => {
        if (e.key === key) callback();
      };
      window.addEventListener('storage', handleStorage);
      return () => {
        set.delete(callback);
        window.removeEventListener('storage', handleStorage);
      };
    },
    [key],
  );

  const getSnap = useCallback(() => getSnapshot(key, initialValue), [key, initialValue]);
  const getServerSnap = useCallback(() => initialValue, [initialValue]);

  const value = useSyncExternalStore(subscribe, getSnap, getServerSnap);

  const setValue = useCallback(
    (next: Updater<T>) => {
      const current = getSnapshot(key, initialValue);
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(current) : next;
      const serialized = JSON.stringify(resolved);
      try {
        window.localStorage.setItem(key, serialized);
      } catch {
        // localStorage unavailable (private browsing quota, etc.) — fail silently.
      }
      cache.set(key, { raw: serialized, parsed: resolved });
      getListeners(key).forEach((callback) => callback());
    },
    [key, initialValue],
  );

  return [value, setValue];
}
