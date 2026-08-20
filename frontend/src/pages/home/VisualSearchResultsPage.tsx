import { useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Camera, X } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProductGrid } from '@/components/product/ProductGrid';
import { ProductFilters } from '@/components/product/ProductFilters';
import { SortDropdown } from '@/components/product/SortDropdown';
import { useProductFacets } from '@/hooks/useProducts';
import { productService, categoryService } from '@/services/productService';
import { scoreVisualMatch } from '@/lib/visualSearchMatch';
import { filtersFromSearchParams, applyFiltersToSearchParams } from '@/lib/filterUrlSync';
import { cn } from '@/lib/utils';
import type { DetectedClothingAttributes, ProductFilters as Filters } from '@/types';

const SESSION_KEY = 'dressmart:visual-search-state';
/** Above this, a product matches on more than just the detected garment type — see
 *  lib/visualSearchMatch.ts's SCORE weights (category+subcategory alone tops out at 55). */
const BEST_MATCH_THRESHOLD = 55;

interface VisualSearchState {
  attrs: DetectedClothingAttributes;
  previewDataUrl: string;
  categorySlugs: string[];
}

function isVisualSearchState(value: unknown): value is VisualSearchState {
  return Boolean(value) && typeof value === 'object' && 'attrs' in (value as object) && 'previewDataUrl' in (value as object);
}

/** Router state (set by SearchBar's navigate() after a photo is analyzed) survives normal
 *  navigation but is lost on a hard refresh — sessionStorage keeps this page working across a
 *  refresh too, without persisting the image anywhere more durable than the current tab. */
function loadVisualSearchState(locationState: unknown): VisualSearchState | null {
  if (isVisualSearchState(locationState)) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(locationState));
    return locationState;
  }
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as unknown;
    return isVisualSearchState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * "DressMart AI Visual Search" results — reuses ProductGrid/ProductCard/ProductFilters exactly as
 * every other listing page does; the only visual-search-specific UI is the uploaded-image header,
 * the detected-category chips, and splitting the (already relevance-sorted) results into "Best
 * Matches" vs. "Similar Products" by score. A single bounded fetch (pageSize 60) rather than
 * infinite scroll — the candidate pool is already scoped to categories related to the detected
 * garment (see visualSearchService.getRelevantCategorySlugs), so it's small enough that the
 * best/similar split doesn't need to cross page boundaries.
 */
export function VisualSearchResultsPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [visualState] = useState(() => loadVisualSearchState(location.state));
  const [selectedCategorySlugs, setSelectedCategorySlugs] = useState<string[]>(visualState?.categorySlugs ?? []);
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>([]);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  const attrs = visualState?.attrs ?? null;

  const filters: Filters = useMemo(
    () => ({
      gender: attrs?.gender ?? undefined,
      categorySlugs: selectedCategorySlugs,
      visualAttributes: attrs ?? undefined,
      pageSize: 60,
      page: 1,
      ...filtersFromSearchParams(searchParams),
    }),
    [attrs, selectedCategorySlugs, searchParams],
  );

  const productsQuery = useQuery({
    queryKey: ['products', 'visual-search', filters],
    queryFn: () => productService.list(filters),
    enabled: Boolean(attrs),
  });
  const facetsQuery = useProductFacets(attrs?.gender ?? undefined, filters.categorySlugs);

  const categoriesQuery = useQuery({
    queryKey: ['categories', 'visual-search', attrs?.gender ?? 'all'],
    queryFn: () => {
      const genders = attrs?.gender ? [attrs.gender] : (['men', 'kids'] as const);
      return Promise.all(genders.map((g) => categoryService.list(g))).then((lists) => lists.flat());
    },
    enabled: Boolean(attrs),
  });
  const matchedCategories = useMemo(
    () => (categoriesQuery.data ?? []).filter((c) => (visualState?.categorySlugs ?? []).includes(c.slug)),
    [categoriesQuery.data, visualState?.categorySlugs],
  );

  const scoredItems = useMemo(() => {
    if (!attrs || !productsQuery.data) return [];
    return productsQuery.data.items.map((product) => ({ product, score: scoreVisualMatch(product, attrs) }));
  }, [attrs, productsQuery.data]);

  /** Computed from whatever's already been fetched, not a shared facet — pattern isn't tracked by
   *  ProductFacets/ProductFilters anywhere else in the app, so this stays local to this page rather
   *  than extending that shared contract for one page's extra filter. */
  const patternOptions = useMemo(() => {
    const counts = new Map<string, number>();
    scoredItems.forEach(({ product }) => {
      const pattern = product.specifications?.pattern;
      if (pattern) counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
    });
    return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
  }, [scoredItems]);

  const refinedItems = useMemo(
    () =>
      selectedPatterns.length
        ? scoredItems.filter(({ product }) => product.specifications?.pattern && selectedPatterns.includes(product.specifications.pattern))
        : scoredItems,
    [scoredItems, selectedPatterns],
  );

  const bestMatches = refinedItems.filter((i) => i.score >= BEST_MATCH_THRESHOLD);
  const similarProducts = refinedItems.filter((i) => i.score < BEST_MATCH_THRESHOLD);
  const similarityScores = useMemo(() => new Map(refinedItems.map((i) => [i.product.id, i.score])), [refinedItems]);

  const updateFilters = (next: Filters) => setSearchParams(applyFiltersToSearchParams(searchParams, next), { replace: true });

  const toggleCategory = (slug: string) => {
    setSelectedCategorySlugs((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
      return next.length > 0 ? next : prev; // never let every category be deselected at once
    });
  };
  const togglePattern = (value: string) =>
    setSelectedPatterns((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));

  if (!attrs || !visualState) {
    return (
      <div className="container-app py-6">
        <Seo title="Visual Search Results" />
        <EmptyState
          icon={Camera}
          title="No image to search with"
          description="Start a new visual search using the camera icon in the search bar."
          actionLabel="Go to Home"
          actionHref="/"
        />
      </div>
    );
  }

  const headline = [attrs.primaryColor, attrs.gender === 'men' ? "Men's" : attrs.gender === 'kids' ? "Kids'" : null, attrs.garmentType]
    .filter(Boolean)
    .join(' ');

  const patternChips = (
    <div>
      <h3 className="mb-2 text-sm font-semibold">Pattern</h3>
      <div className="flex flex-wrap gap-2">
        {patternOptions.map((p) => (
          <button
            key={p.value}
            onClick={() => togglePattern(p.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium',
              selectedPatterns.includes(p.value)
                ? 'border-accent bg-accent-50 text-accent-700 dark:bg-accent-900/30'
                : 'border-primary-300 text-primary-500 dark:border-primary-600 dark:text-primary-300',
            )}
          >
            {p.value} ({p.count})
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="container-app py-6">
      <Seo title="Visual Search Results" description={`Products matching your uploaded photo: ${headline}`} />

      <h1 className="text-xl font-bold sm:text-2xl">Visual Search Results</h1>

      <div className="mt-4 flex flex-col items-center gap-4 rounded-2xl bg-card p-4 text-center dark:bg-card-dark sm:flex-row sm:text-left">
        <img src={visualState.previewDataUrl} alt="Uploaded clothing item" className="h-28 w-28 shrink-0 rounded-xl object-cover" />
        <div>
          <p className="text-sm text-primary-400">AI detected</p>
          <p className="text-lg font-semibold">{headline || 'A clothing item'}</p>
          {attrs.confidence < 0.5 && (
            <p className="mt-1 text-xs text-primary-400">We're not fully confident about this photo — results below may be loosely related.</p>
          )}
        </div>
      </div>

      {matchedCategories.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {matchedCategories.map((c) => (
            <button
              key={c.id}
              onClick={() => toggleCategory(c.slug)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium',
                selectedCategorySlugs.includes(c.slug)
                  ? 'border-accent bg-accent-50 text-accent-700 dark:bg-accent-900/30'
                  : 'border-primary-300 text-primary-500 dark:border-primary-600 dark:text-primary-300',
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-primary-400">{refinedItems.length} products found</p>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsMobileFiltersOpen(true)} className="btn-outline lg:hidden">
            Filters
          </button>
          <SortDropdown value={filters.sort ?? 'popularity'} onChange={(sort) => updateFilters({ ...filters, sort, page: 1 })} popularityLabel="Best Match" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <div className="hidden space-y-4 lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          {patternOptions.length > 0 && <div className="card-surface p-4">{patternChips}</div>}
          <ProductFilters facets={facetsQuery.data} filters={filters} onChange={(next) => updateFilters({ ...next, page: 1 })} />
        </div>

        {isMobileFiltersOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div className="absolute inset-0 bg-primary-950/50" onClick={() => setIsMobileFiltersOpen(false)} />
            <div className="relative ml-auto h-full w-[85%] max-w-sm space-y-4 overflow-y-auto bg-surface p-4 dark:bg-surface-dark">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Filters</h3>
                <button onClick={() => setIsMobileFiltersOpen(false)} aria-label="Close filters">
                  <X size={20} />
                </button>
              </div>
              {patternOptions.length > 0 && patternChips}
              <ProductFilters facets={facetsQuery.data} filters={filters} onChange={(next) => updateFilters({ ...next, page: 1 })} />
            </div>
          </div>
        )}

        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-lg font-semibold">Best Matches</h2>
            <ProductGrid
              products={bestMatches.map((i) => i.product)}
              isLoading={productsQuery.isLoading}
              isError={productsQuery.isError}
              onRetry={() => productsQuery.refetch()}
              emptyMessage="We couldn't find an exact match. Here are some similar products."
              similarityScores={similarityScores}
            />
          </section>

          {!productsQuery.isLoading && similarProducts.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Similar Products</h2>
              <ProductGrid products={similarProducts.map((i) => i.product)} similarityScores={similarityScores} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
