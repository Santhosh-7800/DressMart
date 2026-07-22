import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Skeleton } from '@/components/ui/Skeleton';
import { SimpleBarChart } from '@/components/admin/SimpleBarChart';
import { useAdminOrders } from '@/hooks/useAdminOrders';
import { adminProductService } from '@/services/adminProductService';
import { productViewService } from '@/services/productViewService';
import { formatCurrency } from '@/lib/utils';

export function AdminAnalyticsPage() {
  const { data: orders, isLoading: isLoadingOrders } = useAdminOrders();
  const { data: productData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['admin', 'analytics', 'products'],
    queryFn: () => adminProductService.list('', 1, 2000),
  });
  const { data: viewCounts, isLoading: isLoadingViews } = useQuery({ queryKey: ['admin', 'analytics', 'views'], queryFn: () => productViewService.getViewCounts() });

  const isLoading = isLoadingOrders || isLoadingProducts || isLoadingViews;

  const analytics = useMemo(() => {
    const allOrders = (orders ?? []).filter((o) => o.status !== 'cancelled');
    const products = productData?.items ?? [];
    const productById = new Map(products.map((p) => [p.id, p]));

    const now = new Date();
    const revenueByMonth: { label: string; value: number }[] = [];
    const salesByMonth: { label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = monthDate.toLocaleDateString('en-IN', { month: 'short' });
      const monthOrders = allOrders.filter((o) => {
        const d = new Date(o.placed_at);
        return d.getFullYear() === monthDate.getFullYear() && d.getMonth() === monthDate.getMonth();
      });
      revenueByMonth.push({ label, value: monthOrders.reduce((sum, o) => sum + o.total, 0) });
      salesByMonth.push({ label, value: monthOrders.length });
    }

    const revenueByCategory = new Map<string, number>();
    const revenueByBrand = new Map<string, number>();
    allOrders.forEach((order) => {
      order.items.forEach((item) => {
        const product = productById.get(item.product_id);
        const categoryName = product?.category?.name ?? 'Other';
        const brandName = item.brand_name || 'DressMart';
        revenueByCategory.set(categoryName, (revenueByCategory.get(categoryName) ?? 0) + item.total_price);
        revenueByBrand.set(brandName, (revenueByBrand.get(brandName) ?? 0) + item.total_price);
      });
    });

    const toSorted = (map: Map<string, number>) =>
      [...map.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

    const views = viewCounts ?? {};
    const topViewed = [...Object.entries(views)]
      .map(([productId, count]) => ({ product: productById.get(productId), count }))
      .filter((v) => v.product)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const totalViews = Object.values(views).reduce((sum, v) => sum + v, 0);
    const conversionRate = totalViews > 0 ? (allOrders.length / totalViews) * 100 : 0;

    return { revenueByMonth, salesByMonth, categoryChart: toSorted(revenueByCategory), brandChart: toSorted(revenueByBrand), topViewed, totalViews, conversionRate };
  }, [orders, productData, viewCounts]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div>
      <Seo title="Admin — Analytics" />
      <div className="mb-5 flex items-center gap-2">
        <BarChart3 size={22} className="text-accent" />
        <h1 className="text-2xl font-bold">Analytics</h1>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card-surface p-4">
          <p className="text-xs uppercase tracking-wide text-primary-400">Product Views (this session)</p>
          <p className="mt-1 text-2xl font-bold">{analytics.totalViews.toLocaleString('en-IN')}</p>
        </div>
        <div className="card-surface p-4">
          <p className="text-xs uppercase tracking-wide text-primary-400">Conversion Rate</p>
          <p className="mt-1 text-2xl font-bold">{analytics.conversionRate.toFixed(1)}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card-surface p-5">
          <h2 className="mb-3 font-semibold">Revenue Chart</h2>
          <SimpleBarChart data={analytics.revenueByMonth} formatValue={formatCurrency} />
        </div>
        <div className="card-surface p-5">
          <h2 className="mb-3 font-semibold">Sales Chart (orders)</h2>
          <SimpleBarChart data={analytics.salesByMonth} barColorClassName="fill-admin-orange-light" />
        </div>
        <div className="card-surface p-5">
          <h2 className="mb-3 font-semibold">Category Sales</h2>
          <SimpleBarChart data={analytics.categoryChart} formatValue={formatCurrency} barColorClassName="fill-admin-orange" />
        </div>
        <div className="card-surface p-5">
          <h2 className="mb-3 font-semibold">Brand Sales</h2>
          <SimpleBarChart data={analytics.brandChart} formatValue={formatCurrency} barColorClassName="fill-admin-orange-light" />
        </div>
      </div>

      <div className="card-surface mt-4 p-5">
        <h2 className="mb-3 font-semibold">Most Viewed Products</h2>
        <div className="space-y-2">
          {analytics.topViewed.map(({ product, count }) => (
            <div key={product!.id} className="flex items-center justify-between border-b border-primary-100 py-2 text-sm last:border-0 dark:border-primary-700">
              <span className="line-clamp-1">{product!.name}</span>
              <span className="font-semibold">{count} views</span>
            </div>
          ))}
          {analytics.topViewed.length === 0 && <p className="py-4 text-center text-sm text-primary-400">No product views recorded yet this session.</p>}
        </div>
      </div>
    </div>
  );
}
