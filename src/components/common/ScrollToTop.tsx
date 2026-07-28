import { useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { debugLog } from '@/lib/debugLog';

/**
 * BrowserRouter navigations (Link, NavLink, useNavigate) never trigger a real page load, so the
 * window simply keeps whatever scrollY the previous route left it at unless something resets it —
 * e.g. opening a product from partway down the Home page would otherwise leave Product Details
 * scrolled to that same position instead of starting at the top.
 *
 * The browser's native scroll restoration can't tell PUSH (opening a new page — should start at the
 * top) from POP (Back/Forward — should return you to where you were) any better once we're
 * manually managing it, so this does both itself: PUSH/REPLACE always scroll to top; POP looks up
 * the scroll position this exact history entry (`location.key`) had when it was last left, saved in
 * the module-level map below, and restores it — the actual fix for "Back drops you at the top of a
 * page you'd scrolled down on" / "lost scroll position after returning from a product".
 */
const scrollPositionByKey = new Map<string, number>();

/** Read-only peek at a history entry's saved scroll offset — used by infinite-scroll list pages
 *  (see useInfiniteProductListing) to re-apply the restore a second time once they've finished
 *  re-fetching however many pages were loaded before the shopper navigated away; without this,
 *  the single restore below fires before that content exists and scrolls into a still-short list. */
export function getSavedScrollY(key: string): number | undefined {
  return scrollPositionByKey.get(key);
}

export function ScrollToTop() {
  const { key } = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useLayoutEffect(() => {
    debugLog('route-transition', navigationType, window.location.pathname, 'key=', key);
    if (navigationType === 'POP') {
      const saved = scrollPositionByKey.get(key);
      window.scrollTo({ top: saved ?? 0, left: 0, behavior: 'instant' as ScrollBehavior });
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    }

    // Cleanup runs right before the NEXT navigation's effect, while `key` here still refers to the
    // entry being left — exactly when we want to snapshot its scroll position.
    return () => {
      scrollPositionByKey.set(key, window.scrollY);
    };
  }, [key, navigationType]);

  return null;
}
