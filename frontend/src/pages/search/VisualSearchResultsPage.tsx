import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { Camera, SlidersHorizontal, X } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { ProductGrid } from '@/components/product/ProductGrid';
import { ProductFilters } from '@/components/product/ProductFilters';
import { SortDropdown } from '@/components/product/SortDropdown';
import { InfiniteScrollSentinel } from '@/components/product/InfiniteScrollSentinel';
import { EmptyState } from '@/components/ui/EmptyState';
import { useProductFacets } from '@/hooks/useProducts';
import { useInfiniteProductListing } from '@/hooks/useInfiniteProductListing';
import { filtersFromSearchParams, applyFiltersToSearchParams } from '@/lib/filterUrlSync';
import { scoreVisualMatch, LOW_CONFIDENCE_SCORE_THRESHOLD } from '@/lib/visualSearchMatch';
import { visualSearchService } from '@/services/visualSearchService';
import type { DetectedClothingAttributes, ProductFilters as Filters } from '@/types';

interface VisualSearchLocationState {
  attributes: DetectedClothingAttributes;
  categorySlugs: string[];
  imagePreviewUrl: string | null;
}

export function VisualSearchResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  const state = location.state as VisualSearchLocationState | null;

  const filters: Filters | null = useMemo(() => {
    if (!state) return null;
    return {
      gender: state.attributes.gender ?? undefined,
      categorySlugs: state.categorySlugs,
      visualAttributes: state.attributes,
      pageSize: 24,
      ...filtersFromSearchParams(searchParams),
    };
  }, [state, searchParams]);

  const updateFilters = (next: Filters) => setSearchParams(applyFiltersToSearchParams(searchParams, next), { replace: true });
  const persistLoadedPages = (loadedPages: number) =>
    setSearchParams(applyFiltersToSearchParams(searchParams, { ...filtersFromSearchParams(searchParams), page: loadedPages }), {
      replace: true,
      state: { preserveScroll: true },
    });

  // Hooks can't be called conditionally — pass a filters object that resolves to zero results
  // rather than skipping the hook entirely when there's no location state to search with.
  const productsQuery = useInfiniteProductListing(filters ?? { categorySlugs: [] }, persistLoadedPages);
  const facetsQuery = useProductFacets(filters?.gender, filters?.categorySlugs);

  const similarityScores = useMemo(() => {
    if (!state) return new Map<string, number>();
    return new Map(productsQuery.products.map((p) => [p.id, scoreVisualMatch(p, state.attributes)]));
  }, [productsQuery.products, state]);

  const topScore = Math.max(0, ...Array.from(similarityScores.values()));
  const isLowConfidence = productsQuery.products.length > 0 && topScore < LOW_CONFIDENCE_SCORE_THRESHOLD;

  if (!state) {
    return (
      <div className="container-app py-12">
        <EmptyState
          icon={Camera}
          title="Start a visual search"
          description="Use the camera icon in the search bar to search by image — this page only shows results right after one."
          actionLabel="Go to Home"
          actionHref="/"
        />
      </div>
    );
  }

  const { attributes, imagePreviewUrl } = state;

  return (
    <div className="container-app py-6">
      <Seo title="Visual Search Results" description="Products visually similar to your uploaded photo." />

      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {imagePreviewUrl && <img src={imagePreviewUrl} alt="Your uploaded photo" className="h-16 w-16 shrink-0 rounded-xl object-cover" />}
          <div>
            <h1 className="text-xl font-bold">Visual Search Results</h1>
            <p className="text-sm text-primary-400">{productsQuery.total} products found</p>
            <p className="mt-0.5 text-xs text-primary-400">Detected: {visualSearchService.describeAttributes(attributes)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsMobileFiltersOpen(true)} className="btn-outline lg:hidden">
            <SlidersHorizontal size={15} /> Filters
          </button>
          <SortDropdown
            value={filters?.sort ?? 'popularity'}
            onChange={(sort) => updateFilters({ ...filters, sort, page: 1 })}
            popularityLabel="Relevance"
          />
        </div>
      </div>

      {isLowConfidence && (
        <div className="mb-4 rounded-xl bg-primary-50 p-4 text-sm dark:bg-primary-800">
          <p className="font-semibold text-primary-900 dark:text-white">No exact match found</p>
          <p className="text-primary-500 dark:text-primary-300">We couldn't find an exact match, but here are some similar products.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <div className="hidden lg:block lg:sticky lg:top-24 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <ProductFilters facets={facetsQuery.data} filters={filters ?? {}} onChange={(next) => updateFilters({ ...next, page: 1 })} />
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
              <ProductFilters facets={facetsQuery.data} filters={filters ?? {}} onChange={(next) => updateFilters({ ...next, page: 1 })} />
            </div>
          </div>
        )}

        <div>
          <ProductGrid
            products={productsQuery.products}
            isLoading={productsQuery.isLoading}
            isError={productsQuery.isError}
            onRetry={() => productsQuery.refetch()}
            emptyMessage="We couldn't find any products matching this image. Try a clearer photo, or use text search instead."
            similarityScores={similarityScores}
          />
          <InfiniteScrollSentinel
            sentinelRef={productsQuery.sentinelRef}
            hasNextPage={productsQuery.hasNextPage}
            isFetchingNextPage={productsQuery.isFetchingNextPage}
            hasResults={productsQuery.products.length > 0}
          />
        </div>
      </div>

      <button onClick={() => navigate(-1)} className="sr-only">
        back
      </button>
    </div>
  );
}
