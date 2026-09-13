import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, X, TrendingUp, SlidersHorizontal } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { ProductGrid } from '@/components/product/ProductGrid';
import { ProductFilters } from '@/components/product/ProductFilters';
import { ActiveFilterChips } from '@/components/product/ActiveFilterChips';
import { MobileFilterDrawer } from '@/components/product/MobileFilterDrawer';
import { SortDropdown } from '@/components/product/SortDropdown';
import { InfiniteScrollSentinel } from '@/components/product/InfiniteScrollSentinel';
import { useInfiniteProductListing } from '@/hooks/useInfiniteProductListing';
import { useProductFacets } from '@/hooks/useProducts';
import { useSearch } from '@/hooks/useSearch';
import { filtersFromSearchParams, applyFiltersToSearchParams, hasActiveFilters } from '@/lib/filterUrlSync';
import { userActivityService } from '@/services/userActivityService';
import { useAuth } from '@/contexts/AuthContext';
import type { ProductFilters as Filters } from '@/types';

/** Shown for a bare /search (no ?q=) — reached from the bottom-nav Search tab — instead of
 *  silently rendering the entire catalog under a "Search results for ''" heading. */
function SearchLanding({ onPick }: { onPick: (term: string) => void }) {
  const { recentSearches, trendingSearches, popularSearches, clearRecentSearches } = useSearch();
  const suggestions = trendingSearches.length > 0 ? trendingSearches : popularSearches;

  return (
    <div className="py-6">
      {recentSearches.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-primary-500">Recent Searches</h2>
            <button onClick={clearRecentSearches} className="text-xs font-medium text-accent">
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((term) => (
              <button
                key={term}
                onClick={() => onPick(term)}
                className="rounded-full border border-primary-200 px-3 py-1.5 text-sm text-primary-600 dark:border-primary-600 dark:text-primary-300"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-primary-500">
          <TrendingUp size={15} /> Trending Searches
        </h2>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((term) => (
            <button
              key={term}
              onClick={() => onPick(term)}
              className="rounded-full bg-primary-50 px-3 py-1.5 text-sm text-primary-600 dark:bg-primary-800 dark:text-primary-200"
            >
              {term}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Sort/loaded-page-count live in the URL (see lib/filterUrlSync.ts and useInfiniteProductListing),
 *  same as ProductListingPage — otherwise opening a product from search results and hitting Back
 *  would reset sort/scroll-depth to defaults. */
export function SearchResultsPage() {
  const { user, isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const query = searchParams.get('q') ?? '';

  const filters: Filters = useMemo(
    () => ({ search: query, pageSize: 24, ...filtersFromSearchParams(searchParams) }),
    [query, searchParams],
  );

  const updateFilters = (next: Filters) => setSearchParams(applyFiltersToSearchParams(searchParams, next), { replace: true });
  // preserveScroll: true — see ProductListingPage's identical comment; this fires mid-scroll, not
  // on a deliberate navigation, so it must skip ScrollToTop's normal reset-to-top for REPLACE.
  const persistLoadedPages = (loadedPages: number) =>
    setSearchParams(applyFiltersToSearchParams(searchParams, { ...filtersFromSearchParams(searchParams), page: loadedPages }), {
      replace: true,
      state: { preserveScroll: true },
    });

  const productsQuery = useInfiniteProductListing(filters, persistLoadedPages);
  const facetsQuery = useProductFacets();
  const hasQuery = query.trim().length > 0;

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

  const pickTerm = (term: string) => setSearchParams({ q: term }, { replace: true });

  if (!hasQuery) {
    return (
      <div className="container-app py-6">
        <Seo title="Search" />
        <div className="mb-2 flex items-center gap-2 text-primary-400">
          <SearchIcon size={18} />
          <h1 className="text-lg font-semibold text-primary-900 dark:text-white">Search DressMart</h1>
        </div>
        <SearchLanding onPick={pickTerm} />
      </div>
    );
  }

  return (
    <div className="container-app py-6">
      <Seo title={`Search results for "${query}"`} />
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">Search results for "{query}"</h1>
          <p className="text-sm text-primary-400">{productsQuery.total} products found</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => setSearchParams({}, { replace: true })} aria-label="Clear search" className="tap-target-48 text-primary-400">
            <X size={18} />
          </button>
          <button onClick={() => setIsMobileFiltersOpen(true)} className="btn-outline lg:hidden">
            <SlidersHorizontal size={15} /> Filters
          </button>
          <SortDropdown value={filters.sort ?? 'popularity'} onChange={(sort) => updateFilters({ ...filters, sort, page: 1 })} />
        </div>
      </div>

      <ActiveFilterChips filters={filters} facets={facetsQuery.data} onChange={updateFilters} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <div className="hidden lg:block lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <ProductFilters facets={facetsQuery.data} filters={filters} onChange={(next) => updateFilters({ ...next, page: 1 })} />
        </div>

        <MobileFilterDrawer isOpen={isMobileFiltersOpen} onClose={() => setIsMobileFiltersOpen(false)}>
          <ProductFilters facets={facetsQuery.data} filters={filters} onChange={(next) => updateFilters({ ...next, page: 1 })} />
        </MobileFilterDrawer>

        <div>
          <ProductGrid
            products={productsQuery.products}
            isLoading={productsQuery.isLoading}
            isError={productsQuery.isError}
            onRetry={() => productsQuery.refetch()}
            emptyMessage={hasActiveFilters(filters) ? undefined : `We couldn't find anything for "${query}". Try a different search term.`}
            hasActiveFilters={hasActiveFilters(filters)}
            onClearFilters={() => updateFilters({ search: filters.search, pageSize: filters.pageSize })}
          />
          <InfiniteScrollSentinel
            sentinelRef={productsQuery.sentinelRef}
            hasNextPage={productsQuery.hasNextPage}
            isFetchingNextPage={productsQuery.isFetchingNextPage}
            hasResults={productsQuery.products.length > 0}
          />
        </div>
      </div>
    </div>
  );
}
