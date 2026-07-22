import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Gift } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { useOrder } from '@/hooks/useOrders';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { calculatePointsEarned } from '@/services/rewardsService';

export function OrderSuccessPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { data: order, isLoading } = useOrder(orderId);

  if (isLoading) {
    return (
      <div className="container-app flex justify-center py-16">
        <Skeleton className="h-64 w-full max-w-lg" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container-app py-16 text-center">
        <p className="text-primary-400">Order not found.</p>
        <Link to="/orders" className="mt-4 inline-block text-accent-600 hover:underline">
          View my orders
        </Link>
      </div>
    );
  }

  return (
    <div className="container-app flex justify-center py-16">
      <Seo title="Order Confirmed" />
      <div className="card-surface w-full max-w-lg p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <CheckCircle2 size={32} className="text-emerald-600" />
        </div>
        <h1 className="text-xl font-bold">Order Placed Successfully!</h1>
        <p className="mt-2 text-sm text-primary-400">Thank you for shopping with DressMart. A confirmation has been sent to your registered email.</p>

        <div className="mt-6 space-y-2 rounded-xl bg-primary-50 p-4 text-left text-sm dark:bg-primary-800">
          <div className="flex justify-between">
            <span className="text-primary-400">Order Number</span>
            <span className="font-semibold">{order.order_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-primary-400">Order Total</span>
            <span className="font-semibold">{formatCurrency(order.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-primary-400">Estimated Delivery</span>
            <span className="font-semibold">{formatDate(order.estimated_delivery)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-primary-400">Payment Method</span>
            <span className="font-semibold uppercase">{order.payment_method.replace('_', ' ')}</span>
          </div>
        </div>

        {calculatePointsEarned(order.total) > 0 && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-accent-50 p-3 text-sm text-accent-700 dark:bg-accent-900/10 dark:text-accent-300">
            <Gift size={16} />
            You earned <strong>{calculatePointsEarned(order.total)} reward points</strong> on this order!
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <Link to="/" className="btn-outline w-full">
            Continue Shopping
          </Link>
          <Link to={`/orders/${order.id}`} className="btn-accent w-full">
            Track Order
          </Link>
        </div>
      </div>
    </div>
  );
}
