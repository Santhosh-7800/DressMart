import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, ShoppingBag, Store, IndianRupee, RotateCcw, Repeat, XCircle, CreditCard, Banknote, type LucideIcon } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { useSellerReturns } from '@/hooks/useReturns';
import { useSellerExchanges } from '@/hooks/useExchanges';
import { useCategoryBreakdown, useTopSellingProducts } from '@/hooks/useDashboardData';
import { isAdminRole as checkIsHeadSeller, effectiveSellerId } from '@/lib/roles';
import { formatCurrency } from '@/lib/utils';
import { queryKeys } from '@/lib/queryClient';
import { adminService } from '@/services/adminService';
import { adminStatsService, groupOrdersByStatus, revenueBySeller, paymentMethodBreakdown } from '@/services/adminStatsService';
import { SalesLast7DaysChart, SalesLast30DaysChart, MonthlyRevenueChart } from '@/components/admin/dashboard/charts/SalesTrendChart';
import { OrderStatusPie } from '@/components/admin/dashboard/charts/OrderStatusPie';
import { RankedBarChart } from '@/components/admin/dashboard/charts/RankedBarChart';
import type { Order, OrderStatus } from '@/types';

/** Stable reference so `orders` doesn't become a brand-new [] on every render while the query is
 *  still loading — that would otherwise invalidate every useMemo below on each re-render. */
const EMPTY_ORDERS: Order[] = [];

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

type RangePreset = 'today' | '7d' | '30d' | 'month';
const RANGE_LABELS: Record<RangePreset, string> = { today: 'Today', '7d': '7 Days', '30d': '30 Days', month: 'This Month' };

function rangeStart(preset: RangePreset): Date {
  const now = new Date();
  switch (preset) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}

function KpiCard({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone?: 'danger' }) {
  return (
    <Card hover={false} className="p-3">
      <div className={`mb-1 flex items-center gap-1.5 text-xs ${tone === 'danger' ? 'text-red-500' : 'text-acc-text-secondary'}`}>
        <Icon size={13} /> {label}
      </div>
      <p className="text-lg font-bold text-acc-text dark:text-white">{value}</p>
    </Card>
  );
}

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

export function AdminAnalyticsPage() {
  const { user } = useAuth();
  const headSeller = checkIsHeadSeller(user?.role);
  const sellerId = effectiveSellerId(user);
  const [range, setRange] = useState<RangePreset>('7d');

  // Platform-wide (head-seller) or own-store (seller) recent orders — bounded to the 500 most
  // recent, same as before. Accurate for every range preset as long as fewer than 500 orders fall
  // within the selected window; called out in the subtitle below rather than silently assumed.
  const ordersQuery = useQuery({
    queryKey: queryKeys.admin.recentOrders(500),
    queryFn: () => adminStatsService.fetchRecentOrders(500),
  });
  const sellersQuery = useQuery({
    queryKey: queryKeys.admin.sellers,
    queryFn: () => adminService.listSellers(),
    enabled: headSeller,
  });
  const { data: returns } = useSellerReturns();
  const { data: exchanges } = useSellerExchanges();
  const categoryBreakdown = useCategoryBreakdown(sellerId, headSeller);
  const topSelling = useTopSellingProducts(sellerId, headSeller);

  const orders = ordersQuery.data ?? EMPTY_ORDERS;
  const sellerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sellersQuery.data ?? []) map.set(s.id, s.store_name || s.full_name);
    return map;
  }, [sellersQuery.data]);

  const startDate = useMemo(() => rangeStart(range), [range]);
  const rangeOrders = useMemo(() => orders.filter((o) => new Date(o.placed_at) >= startDate), [orders, startDate]);

  // Real, not-invented KPIs — every figure below is a direct sum/count over real Order/ReturnRequest/
  // ExchangeRequest fields (Order.total, Order.items[].quantity, ReturnRequest.refund_amount), never
  // a fabricated profit/margin figure (no cost-of-goods data exists in this schema to compute one).
  const kpis = useMemo(() => {
    const cancelled = rangeOrders.filter((o) => o.status === 'cancelled');
    const successful = rangeOrders.filter((o) => o.status !== 'cancelled');
    const totalSales = successful.reduce((sum, o) => sum + o.total, 0);
    const itemsSold = successful.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);
    const cancelledValue = cancelled.reduce((sum, o) => sum + o.total, 0);
    const returnsInRange = (returns ?? []).filter((r) => new Date(r.created_at) >= startDate);
    const exchangesInRange = (exchanges ?? []).filter((e) => new Date(e.created_at) >= startDate);
    return {
      totalSales,
      orderCount: rangeOrders.length,
      successfulCount: successful.length,
      aov: successful.length > 0 ? totalSales / successful.length : 0,
      itemsSold,
      cancelledCount: cancelled.length,
      cancelledValue,
      returnedCount: returnsInRange.length,
      returnedValue: returnsInRange.reduce((sum, r) => sum + r.refund_amount, 0),
      exchangeCount: exchangesInRange.length,
      payments: paymentMethodBreakdown(successful),
    };
  }, [rangeOrders, returns, exchanges, startDate]);

  const statusBreakdown = useMemo(() => groupOrdersByStatus(orders), [orders]);
  const topSellers = useMemo(() => revenueBySeller(orders).slice(0, 10), [orders]);
  const maxStatusCount = Math.max(1, ...Object.values(statusBreakdown));
  const maxSellerRevenue = Math.max(1, ...topSellers.map((s) => s.revenue));

  const isLoading = ordersQuery.isLoading || (headSeller && sellersQuery.isLoading);

  return (
    <div className="space-y-6">
      <Seo title="Sales Analytics" />
      <div>
        <h1 className="text-2xl font-bold text-acc-text dark:text-white">Sales Analytics</h1>
        <p className="mt-1 text-sm text-acc-text-secondary">
          Figures below are computed from the {orders.length} most recent orders{headSeller ? ' platform-wide' : ''}.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(RANGE_LABELS) as RangePreset[]).map((key) => (
          <button
            key={key}
            onClick={() => setRange(key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              range === key ? 'bg-accent text-primary-900' : 'bg-primary-100 text-primary-500 dark:bg-primary-800 dark:text-primary-300'
            }`}
          >
            {RANGE_LABELS[key]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : ordersQuery.isError ? (
        <Card hover={false} className="flex flex-col items-center gap-3 py-8 text-center">
          <BarChart3 className="text-red-500" size={24} />
          <p className="text-sm text-acc-text-secondary">Couldn't load analytics data.</p>
          <button onClick={() => ordersQuery.refetch()} className="text-sm font-semibold text-accent">
            Retry
          </button>
        </Card>
      ) : orders.length === 0 ? (
        <EmptyState icon={BarChart3} title="No orders yet" description="Analytics will appear once orders start coming in." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard icon={IndianRupee} label="Total Sales" value={formatCurrency(kpis.totalSales)} />
            <KpiCard icon={ShoppingBag} label="Orders" value={String(kpis.orderCount)} />
            <KpiCard icon={IndianRupee} label="Avg Order Value" value={formatCurrency(kpis.aov)} />
            <KpiCard icon={ShoppingBag} label="Items Sold" value={String(kpis.itemsSold)} />
            <KpiCard icon={XCircle} label="Cancelled Orders" value={`${kpis.cancelledCount} · ${formatCurrency(kpis.cancelledValue)}`} tone="danger" />
            <KpiCard icon={RotateCcw} label="Returned" value={`${kpis.returnedCount} · ${formatCurrency(kpis.returnedValue)}`} />
            <KpiCard icon={Repeat} label="Exchanges" value={String(kpis.exchangeCount)} />
            <KpiCard icon={BarChart3} label="Successful Orders" value={String(kpis.successfulCount)} />
          </div>

          <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-acc-text-secondary">Payment Methods ({RANGE_LABELS[range]})</h2>
            <div className="grid grid-cols-2 gap-3">
              <Card hover={false} className="flex items-center gap-3 p-3">
                <Banknote size={18} className="text-acc-primary" />
                <div>
                  <p className="text-xs text-acc-text-secondary">Cash on Delivery</p>
                  <p className="font-semibold text-acc-text dark:text-white">
                    {kpis.payments.cod.orders} orders · {formatCurrency(kpis.payments.cod.revenue)}
                  </p>
                </div>
              </Card>
              <Card hover={false} className="flex items-center gap-3 p-3">
                <CreditCard size={18} className="text-acc-primary" />
                <div>
                  <p className="text-xs text-acc-text-secondary">Razorpay</p>
                  <p className="font-semibold text-acc-text dark:text-white">
                    {kpis.payments.razorpay.orders} orders · {formatCurrency(kpis.payments.razorpay.revenue)}
                  </p>
                </div>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {range === 'today' || range === '7d' ? (
              <SalesLast7DaysChart sellerId={sellerId} isHeadSeller={headSeller} />
            ) : range === '30d' ? (
              <SalesLast30DaysChart sellerId={sellerId} isHeadSeller={headSeller} />
            ) : (
              <MonthlyRevenueChart sellerId={sellerId} isHeadSeller={headSeller} />
            )}
            <OrderStatusPie sellerId={sellerId} isHeadSeller={headSeller} />

            <RankedBarChart
              title="Category Sales (Units)"
              icon={Store}
              isLoading={categoryBreakdown.isLoading}
              data={categoryBreakdown.data?.map((c) => ({ name: c.category_name, value: c.units_sold }))}
              emptyLabel="No sales yet to break down by category."
            />
            <RankedBarChart
              title="Top Products (Revenue)"
              icon={ShoppingBag}
              isLoading={topSelling.isLoading}
              data={topSelling.data?.map((p) => ({ name: p.product_name, value: p.revenue }))}
              valueFormatter={formatCurrency}
              emptyLabel="No sales yet."
            />

            <Card hover={false}>
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 size={17} className="text-acc-primary" />
                <h2 className="text-base font-bold text-acc-text dark:text-white">Order Status Breakdown (All Time)</h2>
              </div>
              <div className="space-y-2">
                {(Object.keys(STATUS_LABELS) as OrderStatus[])
                  .filter((status) => statusBreakdown[status])
                  .map((status) => (
                    <BarRow key={status} label={STATUS_LABELS[status]} value={statusBreakdown[status] ?? 0} max={maxStatusCount} />
                  ))}
              </div>
            </Card>

            {headSeller && (
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
            )}
          </div>
        </>
      )}
    </div>
  );
}
