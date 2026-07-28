import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Seo } from '@/components/common/Seo';
import { ProductGrid } from '@/components/product/ProductGrid';
import { SortDropdown } from '@/components/product/SortDropdown';
import { InfiniteScrollSentinel } from '@/components/product/InfiniteScrollSentinel';
import { useInfiniteProductListing } from '@/hooks/useInfiniteProductListing';
import { filtersFromSearchParams, applyFiltersToSearchParams } from '@/lib/filterUrlSync';
import type { SortOption } from '@/types';

/** Sort/loaded-page-count live in the URL (see lib/filterUrlSync.ts and useInfiniteProductListing),
 *  same as ProductListingPage — otherwise opening a product from search results and hitting Back
 *  would reset sort/scroll-depth to defaults. */
export function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const { sort, page } = useMemo(() => {
    const f = filtersFromSearchParams(searchParams);
    return { sort: f.sort ?? ('popularity' as SortOption), page: f.page ?? 1 };
  }, [searchParams]);

  const setSort = (nextSort: SortOption) => setSearchParams(applyFiltersToSearchParams(searchParams, { sort: nextSort, page: 1 }), { replace: true });
  const persistLoadedPages = (loadedPages: number) => setSearchParams(applyFiltersToSearchParams(searchParams, { sort, page: loadedPages }), { replace: true });

  const productsQuery = useInfiniteProductListing({ search: query, sort, page, pageSize: 24 }, persistLoadedPages);

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
