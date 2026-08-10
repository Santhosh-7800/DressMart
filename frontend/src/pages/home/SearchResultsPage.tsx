import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Seo } from '@/components/common/Seo';
import { ProductGrid } from '@/components/product/ProductGrid';
import { SortDropdown } from '@/components/product/SortDropdown';
import { InfiniteScrollSentinel } from '@/components/product/InfiniteScrollSentinel';
import { useInfiniteProductListing } from '@/hooks/useInfiniteProductListing';
import { filtersFromSearchParams, applyFiltersToSearchParams } from '@/lib/filterUrlSync';
import { userActivityService } from '@/services/userActivityService';
import { useAuth } from '@/contexts/AuthContext';
import type { SortOption } from '@/types';

/** Sort/loaded-page-count live in the URL (see lib/filterUrlSync.ts and useInfiniteProductListing),
 *  same as ProductListingPage — otherwise opening a product from search results and hitting Back
 *  would reset sort/scroll-depth to defaults. */
export function SearchResultsPage() {
  const { user, isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const { sort, page } = useMemo(() => {
    const f = filtersFromSearchParams(searchParams);
    return { sort: f.sort ?? ('popularity' as SortOption), page: f.page ?? 1 };
  }, [searchParams]);

  const setSort = (nextSort: SortOption) => setSearchParams(applyFiltersToSearchParams(searchParams, { sort: nextSort, page: 1 }), { replace: true });
  // preserveScroll: true — see ProductListingPage's identical comment; this fires mid-scroll, not
  // on a deliberate navigation, so it must skip ScrollToTop's normal reset-to-top for REPLACE.
  const persistLoadedPages = (loadedPages: number) =>
    setSearchParams(applyFiltersToSearchParams(searchParams, { sort, page: loadedPages }), { replace: true, state: { preserveScroll: true } });

  const productsQuery = useInfiniteProductListing({ search: query, sort, page, pageSize: 24 }, persistLoadedPages);

  // Patches the real result count onto the search-history entry useSearch.ts's commitSearch already
  // recorded (with result_count: 0, since that fires before this page's own query resolves) — reuses
  // this page's own already-in-flight product query instead of a dedicated count-only read. Guarded
  // by a ref keyed on the query text so pagination (more pages of the SAME query) never re-fires it.
  const recordedForQueryRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isAuthenticated || !user || !query.trim() || productsQuery.isLoading) return;
    if (recordedForQueryRef.current === query) return;
    recordedForQueryRef.current = query;
    void userActivityService.updateSearchResultCount(user.id, query, productsQuery.total);
  }, [isAuthenticated, user, query, productsQuery.isLoading, productsQuery.total]);

  return (
    <div className="container-app py-6">
      <Seo title={`Search results for "${query}"`} />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Search results for "{query}"</h1>
          <p className="text-sm text-primary-400">{productsQuery.total} products found</p>
        </div>
        <SortDropdown value={sort} onChange={setSort} />
      </div>
      <ProductGrid
        products={productsQuery.products}
        isLoading={productsQuery.isLoading}
        isError={productsQuery.isError}
        onRetry={() => productsQuery.refetch()}
        emptyMessage={`We couldn't find anything for "${query}". Try a different search term.`}
      />
      <InfiniteScrollSentinel
        sentinelRef={productsQuery.sentinelRef}
        hasNextPage={productsQuery.hasNextPage}
        isFetchingNextPage={productsQuery.isFetchingNextPage}
        hasResults={productsQuery.products.length > 0}
      />
    </div>
  );
}
