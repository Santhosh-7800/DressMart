import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import type { Gender, ProductFilters as Filters } from '@/types';
import { Seo } from '@/components/common/Seo';
import { ProductGrid } from '@/components/product/ProductGrid';
import { ProductFilters } from '@/components/product/ProductFilters';
import { SortDropdown } from '@/components/product/SortDropdown';
import { Pagination } from '@/components/ui/Pagination';
import { useProductFacets, useProductList } from '@/hooks/useProducts';
import { useCategoryHistory } from '@/hooks/useCategoryHistory';

interface ProductListingPageProps {
  gender: Gender;
}

export function ProductListingPage({ gender }: ProductListingPageProps) {
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const [searchParams] = useSearchParams();
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    gender,
    categorySlugs: categorySlug ? [categorySlug] : undefined,
    sort: (searchParams.get('sort') as Filters['sort']) ?? 'popularity',
    page: 1,
    pageSize: 24,
  });

  const productsQuery = useProductList({ ...filters, categorySlugs: categorySlug ? [categorySlug] : filters.categorySlugs });
  const facetsQuery = useProductFacets(gender, categorySlug);
  const { recordCategoryView } = useCategoryHistory();

  useEffect(() => {
    if (categorySlug) recordCategoryView(categorySlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorySlug]);

  const totalPages = useMemo(() => Math.ceil((productsQuery.data?.total ?? 0) / (filters.pageSize ?? 24)), [productsQuery.data, filters.pageSize]);

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
          <p className="text-sm text-primary-400">{productsQuery.data?.total ?? 0} products</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsMobileFiltersOpen(true)} className="btn-outline lg:hidden">
            <SlidersHorizontal size={15} /> Filters
          </button>
          <SortDropdown value={filters.sort ?? 'popularity'} onChange={(sort) => setFilters((f) => ({ ...f, sort, page: 1 }))} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <div className="hidden lg:block">
          <ProductFilters facets={facetsQuery.data} filters={filters} onChange={setFilters} />
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
              <ProductFilters facets={facetsQuery.data} filters={filters} onChange={setFilters} />
            </div>
          </div>
        )}

        <div>
          <ProductGrid products={productsQuery.data?.items ?? []} isLoading={productsQuery.isLoading} />
          <Pagination page={filters.page ?? 1} totalPages={totalPages} onChange={(page) => setFilters((f) => ({ ...f, page }))} />
        </div>
      </div>
    </div>
  );
}
