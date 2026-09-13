import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Search, AlertTriangle } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { queryKeys } from '@/lib/queryClient';
import { adminService } from '@/services/adminService';
import { adminStatsService } from '@/services/adminStatsService';
import { formatCurrency, formatDate } from '@/lib/utils';

/** Read-only customer (buyer) directory — Admin-only, see RequireAdmin. Order-derived
 *  metrics (count/value/latest) are computed client-side from a bounded recent-orders slice — the
 *  same fetchRecentOrders() already used by Analytics/Reports — rather than a per-customer query,
 *  so this page stays a small, fixed number of reads regardless of customer-list size. */
export function AdminCustomersPage() {
  const [search, setSearch] = useState('');
  const customersQuery = useQuery({
    queryKey: queryKeys.admin.customers,
    queryFn: () => adminService.listCustomers(),
  });
  const ordersQuery = useQuery({
    queryKey: ['seller', 'customers', 'recent-orders'],
    queryFn: () => adminStatsService.fetchRecentOrders(1000),
  });

  const customers = useMemo(() => customersQuery.data ?? [], [customersQuery.data]);

  const orderStatsByBuyer = useMemo(() => {
    const map = new Map<string, { orderCount: number; totalValue: number; latestOrderAt: string }>();
    for (const order of ordersQuery.data ?? []) {
      const existing = map.get(order.buyer_id) ?? { orderCount: 0, totalValue: 0, latestOrderAt: order.placed_at };
      existing.orderCount += 1;
      // "Total order value" excludes cancelled orders — a cancelled order was never actually
      // fulfilled, so counting its value would overstate what this customer has genuinely bought.
      if (order.status !== 'cancelled') existing.totalValue += order.total;
      if (order.placed_at > existing.latestOrderAt) existing.latestOrderAt = order.placed_at;
      map.set(order.buyer_id, existing);
    }
    return map;
  }, [ordersQuery.data]);

  const visibleCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.full_name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.phone ?? '').toLowerCase().includes(q),
    );
  }, [customers, search]);

  return (
    <div className="space-y-6">
      <Seo title="Customers" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-acc-text dark:text-white">Customers</h1>
        <p className="text-sm text-acc-text-secondary">{customers.length} total</p>
      </div>

      <Input placeholder="Search by name, email or phone" leftIcon={<Search size={15} />} value={search} onChange={(e) => setSearch(e.target.value)} />

      {customersQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : customersQuery.isError ? (
        <Card hover={false} className="flex flex-col items-center gap-3 py-8 text-center">
          <AlertTriangle className="text-red-500" size={24} />
          <p className="text-sm text-acc-text-secondary">Couldn't load customers.</p>
          <Button variant="outline" size="sm" onClick={() => customersQuery.refetch()}>
            Retry
          </Button>
        </Card>
      ) : customers.length === 0 ? (
        <EmptyState icon={Users} title="No customers yet" description="Customer accounts will show up here once buyers sign up." />
      ) : visibleCustomers.length === 0 ? (
        <EmptyState icon={Search} title="No matches" description="No customers match your search." />
      ) : (
        <div className="space-y-3">
          {visibleCustomers.map((customer) => {
            const stats = orderStatsByBuyer.get(customer.id);
            return (
              <Card key={customer.id} hover={false} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-acc-text dark:text-white">{customer.full_name}</p>
                  <p className="text-sm text-acc-text-secondary">
                    {customer.email}
                    {customer.phone ? ` · ${customer.phone}` : ''}
                  </p>
                  <p className="text-xs text-acc-text-secondary">Joined {formatDate(customer.created_at)}</p>
                </div>
                <div className="shrink-0 text-left text-sm sm:text-right">
                  {stats ? (
                    <>
                      <p className="font-semibold text-acc-text dark:text-white">
                        {stats.orderCount} order{stats.orderCount === 1 ? '' : 's'} · {formatCurrency(stats.totalValue)}
                      </p>
                      <p className="text-xs text-acc-text-secondary">Last order {formatDate(stats.latestOrderAt)}</p>
                    </>
                  ) : (
                    <p className="text-xs text-acc-text-secondary">No orders yet</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
