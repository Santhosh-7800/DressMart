/** Thin, typed localStorage wrapper used by the mock service layer. */
const NAMESPACE = 'dressmart:';

export function readStore<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(NAMESPACE + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStore<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(NAMESPACE + key, JSON.stringify(value));
}

export function clearStore(key: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(NAMESPACE + key);
}
