import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, XCircle, RotateCcw, Repeat } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { useOrder, useCancelOrder } from '@/hooks/useOrders';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { OrderTrackingTimeline } from '@/components/orders/OrderTrackingTimeline';
import { ReturnRequestModal } from '@/components/orders/ReturnRequestModal';
import { ExchangeRequestModal } from '@/components/orders/ExchangeRequestModal';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { downloadInvoice } from '@/lib/invoice';
import type { OrderItem } from '@/types';

export function OrderDetailsPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { data: order, isLoading } = useOrder(orderId);
  const cancelOrder = useCancelOrder();

  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [returnItem, setReturnItem] = useState<OrderItem | null>(null);
  const [exchangeItem, setExchangeItem] = useState<OrderItem | null>(null);

  if (isLoading || !order) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const canCancel = !['delivered', 'cancelled', 'returned'].includes(order.status);
  const isDelivered = order.status === 'delivered';

  return (
    <div>
      <Seo title={`Order ${order.order_number}`} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Order #{order.order_number}</h1>
          <p className="text-sm text-primary-400">Placed on {formatDateTime(order.placed_at)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadInvoice(order)}>
            <Download size={14} /> Invoice
          </Button>
          {canCancel && (
            <Button variant="danger" size="sm" onClick={() => setIsCancelOpen(true)}>
              <XCircle size={14} /> Cancel Order
            </Button>
          )}
        </div>
      </div>

      <div className="card-surface mb-6 p-5">
        <h2 className="mb-4 font-semibold">Order Tracking</h2>
        <OrderTrackingTimeline order={order} />
      </div>

      <div className="card-surface mb-6 p-5">
        <h2 className="mb-4 font-semibold">Items</h2>
        <div className="space-y-4">
          {order.items.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-4">
              <img src={item.product_image} alt="" className="h-20 w-16 rounded-lg object-cover" />
              <div className="flex-1">
                <p className="text-sm font-medium">{item.product_name}</p>
                <p className="text-xs text-primary-400">
                  Size: {item.size} · Color: {item.color} · Qty: {item.quantity}
                </p>
                {item.return_status !== 'none' && <p className="text-xs font-medium text-accent-600">Return status: {item.return_status.replace(/_/g, ' ')}</p>}
                {item.exchange_status !== 'none' && <p className="text-xs font-medium text-accent-600">Exchange status: {item.exchange_status.replace(/_/g, ' ')}</p>}
              </div>
              <p className="font-semibold">{formatCurrency(item.total_price)}</p>
              {isDelivered && (
                <div className="flex flex-wrap gap-2">
                  {item.is_return_eligible && item.return_status === 'none' && (
                    <Button variant="outline" size="sm" onClick={() => setReturnItem(item)}>
                      <RotateCcw size={13} /> Return
                    </Button>
                  )}
                  {item.is_exchange_eligible && item.exchange_status === 'none' && (
                    <Button variant="outline" size="sm" onClick={() => setExchangeItem(item)}>
                      <Repeat size={13} /> Exchange
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card-surface p-5">
        <h2 className="mb-3 font-semibold">Delivery Address</h2>
        <p className="text-sm text-primary-500">
          {order.address.full_name} · {order.address.phone}
          <br />
          {order.address.line1}, {order.address.city}, {order.address.state} - {order.address.pincode}
        </p>
      </div>

      <Modal isOpen={isCancelOpen} onClose={() => setIsCancelOpen(false)} title="Cancel this order?">
        <p className="mb-4 text-sm text-primary-500">This action cannot be undone. Your refund (if applicable) will be processed within 5-7 business days.</p>
        <div className="flex gap-3">
          <Button variant="outline" fullWidth onClick={() => setIsCancelOpen(false)}>
            Keep Order
          </Button>
          <Button
            variant="danger"
            fullWidth
            onClick={async () => {
              await cancelOrder.mutateAsync(order.id);
              setIsCancelOpen(false);
            }}
            isLoading={cancelOrder.isPending}
          >
            Yes, Cancel
          </Button>
        </div>
      </Modal>

      {returnItem && <ReturnRequestModal isOpen={Boolean(returnItem)} onClose={() => setReturnItem(null)} order={order} item={returnItem} />}
      {exchangeItem && <ExchangeRequestModal isOpen={Boolean(exchangeItem)} onClose={() => setExchangeItem(null)} order={order} item={exchangeItem} />}
    </div>
  );
}
