import { useEffect, useState } from 'react';
import { Zap, PackageSearch } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { FlashSaleProductCard } from '@/components/product/FlashSaleProductCard';
import { CountdownTimer } from '@/components/product/CountdownTimer';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFlashSales } from '@/hooks/useProducts';

export function FlashSalesPage() {
  const { data, isLoading } = useFlashSales();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDismissedIds(new Set());
  }, [data]);

  const visibleProducts = (data ?? []).filter((product) => !dismissedIds.has(product.id));
  const soonestEndsAt = visibleProducts[0]?.flash_sale_ends_at ?? null;

  const handleExpire = (productId: string) => {
    setDismissedIds((prev) => new Set(prev).add(productId));
  };

  return (
    <div className="container-app py-6">
      <Seo title="Flash Sale" description="Unbeatable prices for a limited time only — grab them before the clock runs out." />

      <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-red-600 to-accent-600 p-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Zap size={28} className="fill-white" />
          <div>
            <h1 className="text-2xl font-bold">Flash Sale</h1>
            <p className="text-sm text-white/80">Steep discounts, limited stock — while supplies last.</p>
          </div>
        </div>
        {soonestEndsAt && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-white/70">Next deal ends in</p>
            <CountdownTimer endsAt={soonestEndsAt} size="lg" />
          </div>
        )}
      </div>

      {isLoading ? (
        <ProductGridSkeleton />
      ) : visibleProducts.length === 0 ? (
        <EmptyState icon={PackageSearch} title="No flash sales right now" description="Check back soon — new flash deals drop throughout the day." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visibleProducts.map((product) => (
            <FlashSaleProductCard key={product.id} product={product} onExpire={handleExpire} />
          ))}
        </div>
      )}
    </div>
  );
}
