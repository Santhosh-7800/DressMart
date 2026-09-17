import { useMemo, useState } from 'react';
import { Package, Truck, Search, ChevronDown, ChevronUp, XCircle } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { useSellerOrdersPaged, useAdvanceOrderStatus, useCancelOrder } from '@/hooks/useOrders';
import { useDebounce } from '@/hooks/useDebounce';
import { orderService, STATUS_LABELS } from '@/services/orderService';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { Order, OrderStatus } from '@/types';

// Mirrors cancelOrder.ts's CANCELLABLE_STATUSES for the buyer-equivalent case.
const OWNER_CANCELLABLE_STATUSES: OrderStatus[] = ['placed', 'confirmed', 'packed'];

const PAYMENT_METHOD_LABELS: Record<Order['payment_method'], string> = { cod: 'Cash on Delivery', razorpay: 'Razorpay' };

const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  placed: 'badge-accent',
  confirmed: 'badge-accent',
  packed: 'badge-accent',
  shipped: 'badge-accent',
  delivered: 'badge-success',
  cancelled: 'badge-danger',
  returned: 'badge-danger',
};

export function AdminOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  // Status filtering happens server-side (see useSellerOrdersPaged) — selecting a status only ever
  // reads orders in that status, never the whole collection. Search stays client-side over the
  // fetched window since Firestore can't substring-match order#/name/phone/product/SKU.
  const { data: orders, isLoading, hasMore, loadMore } = useSellerOrdersPaged(statusFilter);
  const advanceStatus = useAdvanceOrderStatus();
  const cancelOrder = useCancelOrder();
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [trackingTarget, setTrackingTarget] = useState<Order | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courierName, setCourierName] = useState('');
  const [courierPhone, setCourierPhone] = useState('');

  const visibleOrders = useMemo(() => {
    const all = orders ?? [];
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (o) =>
        o.order_number.toLowerCase().includes(q) ||
        o.address.full_name.toLowerCase().includes(q) ||
        o.address.phone.toLowerCase().includes(q) ||
        o.items.some((i) => i.product_name.toLowerCase().includes(q) || (i.sku ?? '').toLowerCase().includes(q)),
    );
    // already ordered desc by placed_at from the query itself — no client-side re-sort needed.
  }, [orders, debouncedSearch]);

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
        <div className="min-w-[200px] flex-1">
          <Input placeholder="Search order #, customer, phone, product, or SKU" leftIcon={<Search size={15} />} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {visibleOrders.length === 0 ? (
        <EmptyState
          icon={Package}
          title={orders && orders.length > 0 ? 'No matching orders' : 'No orders'}
          description={orders && orders.length > 0 ? 'Try a different search or status filter.' : 'Orders for your products will show up here.'}
        />
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

                {expandedId === order.id && (
                  <div className="mt-3 space-y-3 rounded-xl bg-primary-50 p-3 text-sm dark:bg-primary-800/50">
                    <div>
                      <p className="font-medium">{order.address.full_name}</p>
                      <p className="text-xs text-primary-400">{order.address.phone}</p>
                      <p className="mt-1 text-xs text-primary-400">
                        {order.address.line1}, {order.address.city}, {order.address.state} - {order.address.pincode}
                      </p>
                    </div>
                    <div className="space-y-1 border-t border-primary-200 pt-2 dark:border-primary-700">
                      <div className="flex justify-between text-primary-400">
                        <span>Subtotal</span>
                        <span>{formatCurrency(order.subtotal)}</span>
                      </div>
                      {order.discount > 0 && (
                        <div className="flex justify-between text-green-600 dark:text-green-400">
                          <span>Discount{order.coupon_code ? ` (${order.coupon_code})` : ''}</span>
                          <span>-{formatCurrency(order.discount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-primary-400">
                        <span>Shipping</span>
                        <span>{order.shipping_fee > 0 ? formatCurrency(order.shipping_fee) : 'Free'}</span>
                      </div>
                      {order.tax > 0 && (
                        <div className="flex justify-between text-primary-400">
                          <span>Tax</span>
                          <span>{formatCurrency(order.tax)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-primary-200 pt-1 font-semibold dark:border-primary-700">
                        <span>Total</span>
                        <span>{formatCurrency(order.total)}</span>
                      </div>
                      <div className="flex justify-between pt-1 text-primary-400">
                        <span>Payment</span>
                        <span className="font-medium text-primary-700 dark:text-primary-200">
                          {PAYMENT_METHOD_LABELS[order.payment_method]} · {order.payment_status}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-primary-100 pt-3 dark:border-primary-700">
                  {canAdvance && (
                    <Button variant="accent" size="sm" onClick={() => handleAdvance(order)} isLoading={advanceStatus.isPending}>
                      <Truck size={13} /> Mark as {STATUS_LABELS[next as OrderStatus]}
                    </Button>
                  )}
                  {OWNER_CANCELLABLE_STATUSES.includes(order.status) && (
                    <Button variant="danger" size="sm" onClick={() => setCancelTarget(order)}>
                      <XCircle size={13} /> Cancel Order
                    </Button>
                  )}
                  <button
                    onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                    className="ml-auto flex items-center gap-1 text-sm font-medium text-accent"
                  >
                    {expandedId === order.id ? 'Hide Details' : 'View Details'}
                    {expandedId === order.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>
            );
          })}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={loadMore}>
                Load More Orders
              </Button>
            </div>
          )}
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

      <Modal isOpen={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} title="Cancel this order?">
        <p className="mb-4 text-sm text-primary-500">
          This cancels order #{cancelTarget?.order_number}, restocks its items, and notifies the customer that DS LOOKS cancelled it. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" fullWidth onClick={() => setCancelTarget(null)}>
            Keep Order
          </Button>
          <Button
            variant="danger"
            fullWidth
            isLoading={cancelOrder.isPending}
            onClick={async () => {
              if (!cancelTarget) return;
              try {
                await cancelOrder.mutateAsync(cancelTarget.id);
              } finally {
                setCancelTarget(null);
              }
            }}
          >
            Yes, Cancel Order
          </Button>
        </div>
      </Modal>
    </div>
  );
}
