import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { OrderStatusRow } from '@/components/admin/OrderStatusRow';
import { useAdminOrders } from '@/hooks/useAdminOrders';
import type { OrderStatus } from '@/types';

export function AdminOrdersPage() {
  const { data: orders, isLoading } = useAdminOrders();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');

  const filtered = (orders ?? []).filter((o) => statusFilter === 'all' || o.status === statusFilter);

  return (
    <div>
      <Seo title="Admin — Orders" />
      <div className="mb-5 flex items-center gap-2">
        <ShoppingBag size={22} className="text-admin-orange" />
        <h1 className="text-2xl font-bold">Orders</h1>
      </div>

      <div className="mb-4">
        <select className="input-field w-auto text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'all')}>
          <option value="all">All Statuses</option>
          {(['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'] as OrderStatus[]).map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="No orders" description="Customer orders will show up here." />
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <OrderStatusRow key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
