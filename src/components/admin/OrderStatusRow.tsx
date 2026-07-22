import { Button } from '@/components/ui/Button';
import { useSetOrderStatus } from '@/hooks/useAdminOrders';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Order, OrderStatus } from '@/types';

const STATUS_STYLES: Record<OrderStatus, string> = {
  placed: 'admin-badge-warning',
  confirmed: 'admin-badge-info',
  packed: 'admin-badge-info',
  shipped: 'badge-accent',
  out_for_delivery: 'badge-accent',
  delivered: 'badge-success',
  cancelled: 'badge-danger',
  returned: 'badge-danger',
};

const NEXT_ACTION: Partial<Record<OrderStatus, { label: string; next: OrderStatus }>> = {
  placed: { label: 'Accept', next: 'confirmed' },
  confirmed: { label: 'Pack', next: 'packed' },
  packed: { label: 'Ship', next: 'shipped' },
  shipped: { label: 'Out for Delivery', next: 'out_for_delivery' },
  out_for_delivery: { label: 'Deliver', next: 'delivered' },
};

const CANCELLABLE: OrderStatus[] = ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery'];

/** Order fulfillment card — same component used by the full Admin Orders page and the Staff order queue. */
export function OrderStatusRow({ order }: { order: Order }) {
  const setStatus = useSetOrderStatus();
  const action = NEXT_ACTION[order.status];

  return (
    <div className="card-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-row-border pb-3">
        <div>
          <p className="text-sm font-semibold text-admin-text">Order #{order.order_number}</p>
          <p className="text-xs text-admin-text-secondary">Placed {formatDate(order.placed_at)}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={STATUS_STYLES[order.status]}>{order.status.replace(/_/g, ' ')}</span>
          <span className="font-semibold">{formatCurrency(order.total)}</span>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {order.items.map((item) => (
          <p key={item.id} className="text-sm text-admin-text-secondary">
            {item.product_name} · {item.color}/{item.size} × {item.quantity}
          </p>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {action && (
          <Button
            variant="accent"
            size="sm"
            onClick={() => setStatus.mutate({ userId: order.user_id, orderId: order.id, status: action.next })}
            isLoading={setStatus.isPending}
          >
            {action.label}
          </Button>
        )}
        {CANCELLABLE.includes(order.status) && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (confirm('Cancel this order?')) setStatus.mutate({ userId: order.user_id, orderId: order.id, status: 'cancelled' });
            }}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
