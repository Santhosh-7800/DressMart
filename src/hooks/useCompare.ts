import { useCallback, useSyncExternalStore } from 'react';
import toast from 'react-hot-toast';

export const MAX_COMPARE = 4;
const STORAGE_KEY = 'dressmart:compare';

type Listener = () => void;
const listeners = new Set<Listener>();

function readIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

// A single shared, module-level snapshot — every ProductCard on a listing page mounts its own
// CompareToggle, so per-component useState (via useLocalStorage) would go stale the moment a
// sibling card's toggle writes to the same key. useSyncExternalStore keeps every instance in sync.
let cachedIds = readIds();

function writeIds(next: string[]): void {
  cachedIds = next;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string[] {
  return cachedIds;
}

function getServerSnapshot(): string[] {
  return [];
}

export function useCompare() {
  const compareIds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const isComparing = useCallback((productId: string) => compareIds.includes(productId), [compareIds]);

  const toggleCompare = useCallback((productId: string) => {
    const prev = readIds();
    if (prev.includes(productId)) {
      writeIds(prev.filter((id) => id !== productId));
      return;
    }
    if (prev.length >= MAX_COMPARE) {
      toast.error(`You can compare up to ${MAX_COMPARE} products at a time`);
      return;
    }
    writeIds([...prev, productId]);
  }, []);

  const removeFromCompare = useCallback((productId: string) => {
    writeIds(readIds().filter((id) => id !== productId));
  }, []);

  const clearCompare = useCallback(() => writeIds([]), []);

  return { compareIds, isComparing, toggleCompare, removeFromCompare, clearCompare };
}
