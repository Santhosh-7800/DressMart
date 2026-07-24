import { Seo } from '@/components/common/Seo';
import { ProductGrid } from '@/components/product/ProductGrid';
import { useDealsOfTheDay } from '@/hooks/useProducts';

export function DealsPage() {
  const { data, isLoading, isError, refetch } = useDealsOfTheDay();
  return (
    <div className="container-app py-6">
      <Seo title="Deals of the Day" description="Grab today's best discounts on Men's and Kids' wear before they're gone." />
      <h1 className="mb-1 text-2xl font-bold">Deals of the Day</h1>
      <p className="mb-6 text-sm text-primary-400">Limited-time offers, refreshed daily.</p>
      <ProductGrid products={data ?? []} isLoading={isLoading} isError={isError} onRetry={() => refetch()} />
    </div>
  );
}
