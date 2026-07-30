import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wallet, CreditCard, Store, TrendingUp } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency } from '@/lib/utils';
import { queryKeys } from '@/lib/queryClient';
import { sellerAdminService } from '@/services/sellerAdminService';
import { sellerStatsService, revenueBySeller, paymentMethodBreakdown, totalRevenueOf } from '@/services/sellerStatsService';

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function SellerReportsPage() {
  const [fromDate, setFromDate] = useState(isoDateDaysAgo(30));
  const [toDate, setToDate] = useState(isoDateDaysAgo(0));

  const ordersQuery = useQuery({
    queryKey: queryKeys.seller.recentOrders(500),
    queryFn: () => sellerStatsService.fetchRecentOrders(500),
  });

  const sellersQuery = useQuery({
    queryKey: queryKeys.seller.sellers,
    queryFn: () => sellerAdminService.listSellers(),
  });

  const sellerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sellersQuery.data ?? []) map.set(s.id, s.store_name || s.full_name);
    return map;
  }, [sellersQuery.data]);

  const filteredOrders = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`) : null;
    return (ordersQuery.data ?? []).filter((o) => {
      const placed = new Date(o.placed_at);
      if (from && placed < from) return false;
      if (to && placed > to) return false;
      return true;
    });
  }, [ordersQuery.data, fromDate, toDate]);

  const paidOrders = useMemo(() => filteredOrders.filter((o) => o.payment_status === 'paid'), [filteredOrders]);
  const totalRevenue = useMemo(() => totalRevenueOf(paidOrders), [paidOrders]);
  const bySeller = useMemo(() => revenueBySeller(paidOrders), [paidOrders]);
  const byPaymentMethod = useMemo(() => paymentMethodBreakdown(filteredOrders), [filteredOrders]);
  const maxSellerRevenue = Math.max(1, ...bySeller.map((s) => s.revenue));

  const isLoading = ordersQuery.isLoading || sellersQuery.isLoading;

  return (
    <div className="space-y-8">
      <Seo title="Revenue Reports" />
      <div>
        <h1 className="text-2xl font-bold text-acc-text dark:text-white">Revenue Reports</h1>
        <p className="mt-1 text-sm text-acc-text-secondary">
          Based on the {ordersQuery.data?.length ?? 0} most recent platform-wide orders, filtered to your date range.
        </p>
      </div>

      <Card hover={false} className="flex flex-wrap items-end gap-4">
        <Input floating label="From" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="max-w-[180px]" />
        <Input floating label="To" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="max-w-[180px]" />
      </Card>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <EmptyState icon={TrendingUp} title="No orders in this range" description="Try widening the date range." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <Card hover={false} className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acc-primary/10 text-acc-primary">
                <Wallet size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-acc-text dark:text-white">{formatCurrency(totalRevenue)}</p>
                <p className="text-xs text-acc-text-secondary">Total Revenue (paid)</p>
              </div>
            </Card>
            <Card hover={false} className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acc-primary/10 text-acc-primary">
                <CreditCard size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-acc-text dark:text-white">{formatCurrency(byPaymentMethod.razorpay.revenue)}</p>
                <p className="text-xs text-acc-text-secondary">Razorpay ({byPaymentMethod.razorpay.orders} orders)</p>
              </div>
            </Card>
            <Card hover={false} className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acc-primary/10 text-acc-primary">
                <Wallet size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-acc-text dark:text-white">{formatCurrency(byPaymentMethod.cod.revenue)}</p>
                <p className="text-xs text-acc-text-secondary">COD ({byPaymentMethod.cod.orders} orders)</p>
              </div>
            </Card>
          </div>

          <Card hover={false}>
            <div className="mb-4 flex items-center gap-2">
              <Store size={17} className="text-acc-primary" />
              <h2 className="text-base font-bold text-acc-text dark:text-white">Revenue by Seller</h2>
            </div>
            {bySeller.length === 0 ? (
              <p className="text-sm text-acc-text-secondary">No paid orders in this range.</p>
            ) : (
              <div className="space-y-3">
                {bySeller.map((s) => (
                  <div key={s.seller_id} className="flex items-center gap-2 text-xs sm:gap-3 sm:text-sm">
                    <span className="w-20 shrink-0 truncate text-acc-text-secondary sm:w-40">{sellerNameById.get(s.seller_id) ?? s.seller_id}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-primary-100 dark:bg-primary-800">
                      <div className="h-full rounded-full bg-acc-primary" style={{ width: `${Math.max((s.revenue / maxSellerRevenue) * 100, 3)}%` }} />
                    </div>
                    <span className="w-16 shrink-0 text-right font-semibold text-acc-text dark:text-white sm:w-24">{formatCurrency(s.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
