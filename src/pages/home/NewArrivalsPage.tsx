import { Seo } from '@/components/common/Seo';
import { ProductGrid } from '@/components/product/ProductGrid';
import { useNewArrivals } from '@/hooks/useProducts';

export function NewArrivalsPage() {
  const { data, isLoading } = useNewArrivals();
  return (
    <div className="container-app py-6">
      <Seo title="New Arrivals" description="The latest styles just landed at DressMart." />
      <h1 className="mb-6 text-2xl font-bold">New Arrivals</h1>
      <ProductGrid products={data ?? []} isLoading={isLoading} />
    </div>
  );
}
