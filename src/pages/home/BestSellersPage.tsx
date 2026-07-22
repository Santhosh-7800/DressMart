import { Seo } from '@/components/common/Seo';
import { ProductGrid } from '@/components/product/ProductGrid';
import { useBestSellers } from '@/hooks/useProducts';

export function BestSellersPage() {
  const { data, isLoading } = useBestSellers();
  return (
    <div className="container-app py-6">
      <Seo title="Best Sellers" description="The most-loved styles at DressMart, chosen by thousands of customers." />
      <h1 className="mb-6 text-2xl font-bold">Best Sellers</h1>
      <ProductGrid products={data ?? []} isLoading={isLoading} />
    </div>
  );
}
