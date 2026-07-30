import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import type { ProductFilters } from '@/types';
import { getSavedScrollY } from '@/components/common/ScrollToTop';
import { useInfiniteProductList } from './useProducts';

/**
 * Shared infinite-scroll wiring for product-list pages (category listing, search results).
 *
 * Filters/sort already live in the URL so Back restores them (see lib/filterUrlSync.ts) — this
 * extends that same idea to "how many pages were loaded", reusing the existing `page` param's
 * meaning as "pages loaded so far" instead of "current page". Without it, opening a product from
 * partway down a scrolled list and hitting Back would remount to a single page of results while
 * ScrollToTop (location.key-based, see that file) tries to restore the scroll offset from when 3
 * pages were on screen — landing the shopper somewhere wrong, the same failure class as the
 * earlier blank-page-on-Back bug, just for a shorter list instead of a blank one.
 *
 * `initialLoadedPages` is captured once at mount (a ref, not derived reactively from the filters
 * prop) so the URL-persist effect below can't shrink the catch-up target mid-climb: persisting the
 * in-progress page count (1, then 2, ...) while still catching up to a remembered 3 would move the
 * goalposts every render and strand the catch-up loop short of where the shopper actually was.
 */
export function useInfiniteProductListing(filters: ProductFilters, onPersistLoadedPages: (loadedPages: number) => void) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const initialLoadedPagesRef = useRef(filters.page ?? 1);

  const query = useInfiniteProductList(filters);
  const products = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const total = query.data?.pages[0]?.total ?? 0;
  const loadedPageCount = query.data?.pages.length ?? 0;

  useEffect(() => {
    if (loadedPageCount > initialLoadedPagesRef.current) {
      onPersistLoadedPages(loadedPageCount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedPageCount]);

  useEffect(() => {
    if (!query.isFetchingNextPage && query.hasNextPage && loadedPageCount > 0 && loadedPageCount < initialLoadedPagesRef.current) {
      query.fetchNextPage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedPageCount, query.isFetchingNextPage, query.hasNextPage]);

  // Only ever a candidate for correction when the URL already encoded more than one loaded page AT
  // MOUNT — i.e. we're genuinely restoring state a prior visit persisted, not a fresh single-page
  // visit. Without this, a fresh visit's navigationType (React Router classifies the very first
  // load as 'POP', same as a real Back navigation) combined with a stale StrictMode-double-invoke
  // scroll-position artifact for that entry would "correct" the shopper's scroll back to 0 the
  // instant page 2 finishes loading — yanking them to the top mid-scroll on an ordinary first visit.
  const isRestoringPriorVisit = initialLoadedPagesRef.current > 1;
  const hasCaughtUp = loadedPageCount >= initialLoadedPagesRef.current && !query.isFetchingNextPage;
  useEffect(() => {
    if (!isRestoringPriorVisit || navigationType !== 'POP' || !hasCaughtUp) return;
    const saved = getSavedScrollY(location.key);
    if (saved !== undefined) window.scrollTo({ top: saved, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [isRestoringPriorVisit, hasCaughtUp, navigationType, location.key]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !query.hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
          query.fetchNextPage();
        }
      },
      { rootMargin: '600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.hasNextPage, query.isFetchingNextPage]);

  return {
    products,
    total,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    sentinelRef,
  };
}
