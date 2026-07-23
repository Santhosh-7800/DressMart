import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, ShoppingBag, Package, Store } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency } from '@/lib/utils';
import { queryKeys } from '@/lib/queryClient';
import { sellerAdminService } from '@/services/sellerAdminService';
import { sellerStatsService, groupOrdersByStatus, groupOrdersByDay, topProductsFromOrders, revenueBySeller } from '@/services/sellerStatsService';
import type { OrderStatus } from '@/types';

const STATUS_LABELS: Record<OrderStatus, string> = {
  placed: 'Placed',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

/** Thin, single-hue magnitude bar with a direct label — identity comes from the label, not the color. */
function BarRow({ label, value, max, formatValue }: { label: string; value: number; max: number; formatValue?: (v: number) => string }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 3 : 0) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-32 shrink-0 truncate text-acc-text-secondary">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-primary-100 dark:bg-primary-800">
        <div className="h-full rounded-full bg-acc-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 shrink-0 text-right font-semibold text-acc-text dark:text-white">{formatValue ? formatValue(value) : value}</span>
    </div>
  );
}

export function SellerAnalyticsPage() {
  const [rangeDays] = useState(14);

  const ordersQuery = useQuery({
    queryKey: queryKeys.seller.recentOrders(500),
    queryFn: () => sellerStatsService.fetchRecentOrders(500),
  });

  const sellersQuery = useQuery({
    queryKey: queryKeys.seller.sellers,
    queryFn: () => sellerAdminService.listSellers(),
  });

  const orders = ordersQuery.data ?? [];
  const sellerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sellersQuery.data ?? []) map.set(s.id, s.store_name || s.full_name);
    return map;
  }, [sellersQuery.data]);

  const statusBreakdown = useMemo(() => groupOrdersByStatus(orders), [orders]);
  const dailyBuckets = useMemo(() => groupOrdersByDay(orders, rangeDays), [orders, rangeDays]);
  const topProducts = useMemo(() => topProductsFromOrders(orders, 10), [orders]);
  const topSellers = useMemo(() => revenueBySeller(orders).slice(0, 10), [orders]);

  const maxStatusCount = Math.max(1, ...Object.values(statusBreakdown));
  const maxDailyCount = Math.max(1, ...dailyBuckets.map((d) => d.count));
  const maxProductUnits = Math.max(1, ...topProducts.map((p) => p.units_sold));
  const maxSellerRevenue = Math.max(1, ...topSellers.map((s) => s.revenue));

  const isLoading = ordersQuery.isLoading || sellersQuery.isLoading;

  return (
    <div className="space-y-8">
      <Seo title="Platform Analytics" />
      <div>
        <h1 className="text-2xl font-bold text-acc-text dark:text-white">Platform Analytics</h1>
        <p className="mt-1 text-sm text-acc-text-secondary">
          Based on the {orders.length} most recent platform-wide orders.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState icon={BarChart3} title="No orders yet" description="Analytics will appear once orders start coming in." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card hover={false}>
            <div className="mb-4 flex items-center gap-2">
              <ShoppingBag size={17} className="text-acc-primary" />
              <h2 className="text-base font-bold text-acc-text dark:text-white">Orders — last {rangeDays} days</h2>
            </div>
            <div className="space-y-2">
              {dailyBuckets.map((d) => (
                <BarRow key={d.date} label={d.date.slice(5)} value={d.count} max={maxDailyCount} />
              ))}
            </div>
          </Card>

          <Card hover={false}>
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 size={17} className="text-acc-primary" />
              <h2 className="text-base font-bold text-acc-text dark:text-white">Order Status Breakdown</h2>
            </div>
            <div className="space-y-2">
              {(Object.keys(STATUS_LABELS) as OrderStatus[])
                .filter((status) => statusBreakdown[status])
                .map((status) => (
                  <BarRow key={status} label={STATUS_LABELS[status]} value={statusBreakdown[status] ?? 0} max={maxStatusCount} />
                ))}
            </div>
          </Card>

          <Card hover={false}>
            <div className="mb-4 flex items-center gap-2">
              <Package size={17} className="text-acc-primary" />
              <h2 className="text-base font-bold text-acc-text dark:text-white">Top Products (by units sold)</h2>
            </div>
            {topProducts.length === 0 ? (
              <p className="text-sm text-acc-text-secondary">No product sales yet.</p>
            ) : (
              <div className="space-y-2">
                {topProducts.map((p) => (
                  <BarRow key={p.product_id} label={p.product_name} value={p.units_sold} max={maxProductUnits} />
                ))}
              </div>
            )}
          </Card>

          <Card hover={false}>
            <div className="mb-4 flex items-center gap-2">
              <Store size={17} className="text-acc-primary" />
              <h2 className="text-base font-bold text-acc-text dark:text-white">Top Sellers (by revenue)</h2>
            </div>
            {topSellers.length === 0 ? (
              <p className="text-sm text-acc-text-secondary">No seller sales yet.</p>
            ) : (
              <div className="space-y-2">
                {topSellers.map((s) => (
                  <BarRow
                    key={s.seller_id}
                    label={sellerNameById.get(s.seller_id) ?? s.seller_id}
                    value={s.revenue}
                    max={maxSellerRevenue}
                    formatValue={formatCurrency}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
