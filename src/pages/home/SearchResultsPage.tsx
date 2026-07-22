import { useSearchParams } from 'react-router-dom';
import { Seo } from '@/components/common/Seo';
import { ProductGrid } from '@/components/product/ProductGrid';
import { SortDropdown } from '@/components/product/SortDropdown';
import { Pagination } from '@/components/ui/Pagination';
import { useProductList } from '@/hooks/useProducts';
import { useState, useMemo } from 'react';
import type { SortOption } from '@/types';

export function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const [sort, setSort] = useState<SortOption>('popularity');
  const [page, setPage] = useState(1);

  const productsQuery = useProductList({ search: query, sort, page, pageSize: 24 });
  const totalPages = useMemo(() => Math.ceil((productsQuery.data?.total ?? 0) / 24), [productsQuery.data]);

  return (
    <div className="container-app py-6">
      <Seo title={`Search results for "${query}"`} />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Search results for "{query}"</h1>
          <p className="text-sm text-primary-400">{productsQuery.data?.total ?? 0} products found</p>
        </div>
        <SortDropdown value={sort} onChange={setSort} />
      </div>
      <ProductGrid products={productsQuery.data?.items ?? []} isLoading={productsQuery.isLoading} emptyMessage={`We couldn't find anything for "${query}". Try a different search term.`} />
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}
