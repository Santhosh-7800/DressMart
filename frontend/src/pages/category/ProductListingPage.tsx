import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import type { Gender, ProductFilters as Filters } from '@/types';
import { Seo } from '@/components/common/Seo';
import { ProductGrid } from '@/components/product/ProductGrid';
import { ProductFilters } from '@/components/product/ProductFilters';
import { NarrowYourSearch } from '@/components/product/NarrowYourSearch';
import { SortDropdown } from '@/components/product/SortDropdown';
import { InfiniteScrollSentinel } from '@/components/product/InfiniteScrollSentinel';
import { useProductFacets } from '@/hooks/useProducts';
import { useInfiniteProductListing } from '@/hooks/useInfiniteProductListing';
import { useCategoryHistory } from '@/hooks/useCategoryHistory';
import { filtersFromSearchParams, applyFiltersToSearchParams } from '@/lib/filterUrlSync';

interface ProductListingPageProps {
  gender: Gender;
}

/**
 * Filters/sort live in the URL query string (see lib/filterUrlSync.ts), not plain useState —
 * that's what makes them survive Back navigation: opening a product and returning restores this
 * exact URL (filters and all) instead of remounting to a reset default state. The `page` param's
 * meaning is repurposed for infinite scroll: it now tracks "how many pages have been loaded" (see
 * useInfiniteProductListing) rather than "which single page is showing". Filter/sort changes use
 * `replace` so tweaking a filter doesn't pile up history entries — Back from the listing page
 * should return to wherever you came from, not step through every filter tweak one at a time.
 */
export function ProductListingPage({ gender }: ProductListingPageProps) {
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  const filters: Filters = useMemo(
    () => ({
      gender,
      categorySlugs: categorySlug ? [categorySlug] : undefined,
      pageSize: 24,
      ...filtersFromSearchParams(searchParams),
    }),
    [gender, categorySlug, searchParams],
  );

  const updateFilters = (next: Filters) => {
    setSearchParams(applyFiltersToSearchParams(searchParams, next), { replace: true });
  };

  const persistLoadedPages = (loadedPages: number) => {
    // preserveScroll: true — this fires while the shopper is mid-scroll loading more pages, not on
    // a deliberate navigation, so it must not trigger ScrollToTop's normal reset-to-top for REPLACE
    // navigations (see that file's docstring).
    setSearchParams(applyFiltersToSearchParams(searchParams, { ...filtersFromSearchParams(searchParams), page: loadedPages }), {
      replace: true,
      state: { preserveScroll: true },
    });
  };

  const productsQuery = useInfiniteProductListing(filters, persistLoadedPages);
  const facetsQuery = useProductFacets(gender, categorySlug);
  const { recordCategoryView } = useCategoryHistory();

  useEffect(() => {
    if (categorySlug) recordCategoryView(categorySlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorySlug]);

  const categoryLabel = categorySlug
    ? categorySlug
        .split('-')
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(' ')
    : gender === 'men'
      ? "Men's Wear"
      : "Kids' Wear";

  return (
    <div className="container-app py-6">
      <Seo title={categoryLabel} description={`Shop ${categoryLabel} at DressMart — best prices, fast delivery, easy returns.`} />

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">{categoryLabel}</h1>
          <p className="text-sm text-primary-400">{productsQuery.total} products</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsMobileFiltersOpen(true)} className="btn-outline lg:hidden">
            <SlidersHorizontal size={15} /> Filters
          </button>
          <SortDropdown value={filters.sort ?? 'popularity'} onChange={(sort) => updateFilters({ ...filters, sort, page: 1 })} />
        </div>
      </div>

      <NarrowYourSearch facets={facetsQuery.data} filters={filters} onChange={(next) => updateFilters({ ...next, page: 1 })} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <div className="hidden lg:block">
          <ProductFilters facets={facetsQuery.data} filters={filters} onChange={(next) => updateFilters({ ...next, page: 1 })} />
        </div>

        {isMobileFiltersOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div className="absolute inset-0 bg-primary-950/50" onClick={() => setIsMobileFiltersOpen(false)} />
            <div className="relative ml-auto h-full w-[85%] max-w-sm overflow-y-auto bg-surface p-4 dark:bg-surface-dark">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">Filters</h3>
                <button onClick={() => setIsMobileFiltersOpen(false)} aria-label="Close filters">
                  <X size={20} />
                </button>
              </div>
              <ProductFilters facets={facetsQuery.data} filters={filters} onChange={(next) => updateFilters({ ...next, page: 1 })} />
            </div>
          </div>
        )}

        <div>
          <ProductGrid
            products={productsQuery.products}
            isLoading={productsQuery.isLoading}
            isError={productsQuery.isError}
            onRetry={() => productsQuery.refetch()}
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
