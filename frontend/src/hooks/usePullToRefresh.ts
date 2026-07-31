import { useCallback, useRef, useState, type TouchEvent } from 'react';

const MAX_PULL = 120;
const RESISTANCE = 0.5;

/**
 * Hand-rolled pull-to-refresh — no gesture library in this project provides one. Only starts
 * tracking when the touch begins at scrollY 0 (otherwise it would hijack ordinary scrolling
 * anywhere else on the page), applies rubber-band resistance past that point the same way native
 * pull-to-refresh does, and calls `onRefresh` once released past the threshold. Pair with
 * `overscroll-behavior-y: contain` (see index.css) so the browser's own native pull-to-refresh
 * doesn't also fire and double up with this one.
 */
export function usePullToRefresh(onRefresh: () => Promise<unknown> | unknown, threshold = 70) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);

  const onTouchStart = useCallback(
    (e: TouchEvent) => {
      if (isRefreshing || window.scrollY > 0) return;
      startYRef.current = e.touches[0].clientY;
    },
    [isRefreshing],
  );

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      if (startYRef.current === null || isRefreshing) return;
      const delta = e.touches[0].clientY - startYRef.current;
      setPullDistance(delta > 0 ? Math.min(delta * RESISTANCE, MAX_PULL) : 0);
    },
    [isRefreshing],
  );

  const onTouchEnd = useCallback(async () => {
    if (startYRef.current === null) return;
    startYRef.current = null;
    if (pullDistance < threshold) {
      setPullDistance(0);
      return;
    }
    setIsRefreshing(true);
    setPullDistance(threshold);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [pullDistance, threshold, onRefresh]);

  return { pullDistance, isRefreshing, handlers: { onTouchStart, onTouchMove, onTouchEnd } };
}
