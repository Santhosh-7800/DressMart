import { Link } from 'react-router-dom';
import { Download, RefreshCcw, RotateCcw, Repeat, Star } from 'lucide-react';
import type { Order, OrderItem } from '@/types';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/utils';
import { downloadInvoice } from '@/lib/invoice';

const STATUS_STYLES: Record<string, string> = {
  placed: 'badge-accent',
  confirmed: 'badge-accent',
  packed: 'badge-accent',
  shipped: 'badge-accent',
  out_for_delivery: 'badge-accent',
  delivered: 'badge-success',
  cancelled: 'badge-danger',
  returned: 'badge-danger',
};

interface OrderCardProps {
  order: Order;
  onBuyAgain: (order: Order) => void;
  onRequestReturn: (order: Order, item: OrderItem) => void;
  onRequestExchange: (order: Order, item: OrderItem) => void;
}

export function OrderCard({ order, onBuyAgain, onRequestReturn, onRequestExchange }: OrderCardProps) {
  const isDelivered = order.status === 'delivered';

  return (
    <div className="card-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-primary-100 pb-3 dark:border-primary-700">
        <div>
          <p className="text-sm font-semibold">Order #{order.order_number}</p>
          <p className="text-xs text-primary-400">Placed on {formatDate(order.placed_at)}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={STATUS_STYLES[order.status]}>{order.status.replace(/_/g, ' ')}</span>
          <span className="font-semibold">{formatCurrency(order.total)}</span>
        </div>
      </div>

      <div className="space-y-3">
        {order.items.map((item) => (
          <div key={item.id} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link to={`/orders/${order.id}`} className="flex flex-1 items-center gap-3">
              <img src={item.product_image} alt="" className="h-16 w-14 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.product_name}</p>
                <p className="text-xs text-primary-400">{item.brand_name || 'DressMart'}</p>
                <p className="text-xs text-primary-400">
                  Color: {item.color} · Size: {item.size} · Qty: {item.quantity}
                </p>
                {item.return_status !== 'none' && <p className="mt-0.5 text-xs font-medium text-accent-600">Return status: {item.return_status.replace(/_/g, ' ')}</p>}
                {item.exchange_status !== 'none' && <p className="mt-0.5 text-xs font-medium text-accent-600">Exchange status: {item.exchange_status.replace(/_/g, ' ')}</p>}
              </div>
            </Link>

            {isDelivered && (
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                {item.product_slug && (
                  <Link to={`/product/${item.product_slug}`} className="btn-outline !px-3 !py-1.5 text-xs">
                    <Star size={13} /> Write Review
                  </Link>
                )}
                {item.is_return_eligible && item.return_status === 'none' && (
                  <Button variant="outline" size="sm" onClick={() => onRequestReturn(order, item)}>
                    <RotateCcw size={13} /> Return
                  </Button>
                )}
                {item.is_exchange_eligible && item.exchange_status === 'none' && (
                  <Button variant="outline" size="sm" onClick={() => onRequestExchange(order, item)}>
                    <Repeat size={13} /> Exchange
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-primary-100 pt-3 dark:border-primary-700">
        <Button variant="outline" size="sm" onClick={() => downloadInvoice(order)}>
          <Download size={13} /> Download Invoice
        </Button>
        {isDelivered && (
          <Button variant="accent" size="sm" onClick={() => onBuyAgain(order)}>
            <RefreshCcw size={13} /> Buy Again
          </Button>
        )}
        <Link to={`/orders/${order.id}`} className="btn-ghost !px-3 !py-1.5 text-xs">
          View Details
        </Link>
      </div>
    </div>
  );
}
