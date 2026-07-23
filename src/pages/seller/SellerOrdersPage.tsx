import { useMemo, useState } from 'react';
import { Package, Truck } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { useSellerOrders, useAdvanceOrderStatus } from '@/hooks/useOrders';
import { orderService, STATUS_LABELS } from '@/services/orderService';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { Order, OrderStatus } from '@/types';

const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  placed: 'badge-accent',
  confirmed: 'badge-accent',
  packed: 'badge-accent',
  shipped: 'badge-accent',
  out_for_delivery: 'badge-accent',
  delivered: 'badge-success',
  cancelled: 'badge-danger',
  returned: 'badge-danger',
};

export function SellerOrdersPage() {
  const { data: orders, isLoading } = useSellerOrders();
  const advanceStatus = useAdvanceOrderStatus();

  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [trackingTarget, setTrackingTarget] = useState<Order | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courierName, setCourierName] = useState('');
  const [courierPhone, setCourierPhone] = useState('');

  const visibleOrders = useMemo(() => {
    const all = orders ?? [];
    const filtered = statusFilter === 'all' ? all : all.filter((o) => o.status === statusFilter);
    return [...filtered].sort((a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime());
  }, [orders, statusFilter]);

  const handleAdvance = (order: Order) => {
    const next = orderService.nextStatus(order.status);
    if (!next) return;
    if (next === 'shipped') {
      setTrackingTarget(order);
      setTrackingNumber(order.tracking_number ?? '');
      setCourierName(order.courier_name ?? '');
      setCourierPhone(order.courier_phone ?? '');
      return;
    }
    advanceStatus.mutate({ order, input: { nextStatus: next } });
  };

  const handleConfirmShip = async () => {
    if (!trackingTarget) return;
    await advanceStatus.mutateAsync({
      order: trackingTarget,
      input: { nextStatus: 'shipped', trackingNumber: trackingNumber || undefined, courierName: courierName || undefined, courierPhone: courierPhone || undefined },
    });
    setTrackingTarget(null);
  };

  if (isLoading) {
    return (
      <div className="container-app py-8 space-y-3">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="container-app py-8">
      <Seo title="Seller Orders" />
      <h1 className="mb-4 text-2xl font-bold">Orders</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'all')} className="input-field w-auto text-sm">
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {visibleOrders.length === 0 ? (
        <EmptyState icon={Package} title="No orders" description="Orders for your products will show up here." />
      ) : (
        <div className="space-y-3">
          {visibleOrders.map((order) => {
            const next = orderService.nextStatus(order.status);
            const canAdvance = next !== null && order.status !== 'cancelled';
            return (
              <div key={order.id} className="card-surface p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-primary-100 pb-3 dark:border-primary-700">
                  <div>
                    <p className="text-sm font-semibold">Order #{order.order_number}</p>
                    <p className="text-xs text-primary-400">Placed on {formatDateTime(order.placed_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={STATUS_BADGE_CLASS[order.status]}>{order.status.replace(/_/g, ' ')}</span>
                    <span className="font-semibold">{formatCurrency(order.total)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 text-sm">
                      <img src={item.product_image} alt="" className="h-14 w-12 shrink-0 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.product_name}</p>
                        <p className="text-xs text-primary-400">
                          Size: {item.size} · Color: {item.color} · Qty: {item.quantity}
                        </p>
                      </div>
                      <p className="font-medium">{formatCurrency(item.total_price)}</p>
                    </div>
                  ))}
                </div>

                {order.tracking_number && (
                  <p className="mt-3 text-xs text-primary-400">
                    Tracking: <span className="font-medium text-primary-700 dark:text-primary-200">{order.tracking_number}</span>
                    {order.courier_name ? ` · ${order.courier_name}` : ''}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2 border-t border-primary-100 pt-3 dark:border-primary-700">
                  {canAdvance && (
                    <Button variant="accent" size="sm" onClick={() => handleAdvance(order)} isLoading={advanceStatus.isPending}>
                      <Truck size={13} /> Mark as {STATUS_LABELS[next as OrderStatus]}
                    </Button>
                  )}
                  {order.payment_method === 'cod' && (
                    <span className="badge-accent">COD · {order.payment_status}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={Boolean(trackingTarget)} onClose={() => setTrackingTarget(null)} title="Add Tracking Info & Ship">
        <div className="space-y-3">
          <Input label="Tracking Number" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
          <Input label="Courier Name" value={courierName} onChange={(e) => setCourierName(e.target.value)} />
          <Input label="Courier Phone" value={courierPhone} onChange={(e) => setCourierPhone(e.target.value)} />
          <Button variant="accent" fullWidth onClick={handleConfirmShip} isLoading={advanceStatus.isPending}>
            Mark as Shipped
          </Button>
        </div>
      </Modal>
    </div>
  );
}
