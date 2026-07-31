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
 *
 * One escape hatch: a REPLACE navigation whose `location.state.preserveScroll` is true skips the
 * reset-to-top entirely. Every REPLACE generates a brand-new `location.key` (React Router mints one
 * per push AND replace), so infinite-scroll list pages silently persisting "how many pages are
 * loaded" via a background replace (see useInfiniteProductListing) would otherwise fight the
 * shopper's own scrolling — each persisted page count yanking them back to the top mid-scroll. A
 * deliberate filter/sort change (a REAL reason to jump to the top of the new result set) doesn't
 * set this flag, so it keeps resetting to top as before.
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
  const location = useLocation();
  const { key } = location;
  const navigationType = useNavigationType();
  const preserveScroll = (location.state as { preserveScroll?: boolean } | null)?.preserveScroll === true;

  useLayoutEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useLayoutEffect(() => {
    debugLog('route-transition', navigationType, window.location.pathname, 'key=', key, 'preserveScroll=', preserveScroll);
    if (navigationType === 'POP') {
      const saved = scrollPositionByKey.get(key);
      window.scrollTo({ top: saved ?? 0, left: 0, behavior: 'instant' as ScrollBehavior });
    } else if (!preserveScroll) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    }

    // Cleanup runs right before the NEXT navigation's effect, while `key` here still refers to the
    // entry being left — exactly when we want to snapshot its scroll position.
    return () => {
      scrollPositionByKey.set(key, window.scrollY);
    };
  }, [key, navigationType, preserveScroll]);

  return null;
}
