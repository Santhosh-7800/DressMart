import { Link, useLocation, useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { useOrderGroup } from '@/hooks/useOrders';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

export function OrderSuccessPage() {
  // Accepts either param name so this keeps working whichever the route ends up using
  // (`/order-success/:groupId` is the intended shape; `:orderId` is the current stale route).
  const params = useParams<{ groupId?: string; orderId?: string }>();
  const location = useLocation();
  const navState = location.state as { orderNumber?: string; groupId?: string } | null;
  const effectiveGroupId = params.groupId ?? params.orderId ?? navState?.groupId;

  const { data: shipments, isLoading } = useOrderGroup(effectiveGroupId);

  if (isLoading) {
    return (
      <div className="container-app flex justify-center py-16">
        <Skeleton className="h-64 w-full max-w-lg" />
      </div>
    );
  }

  if (!shipments || shipments.length === 0) {
    return (
      <div className="container-app py-16 text-center">
        {navState?.orderNumber ? (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2 size={32} className="text-emerald-600" />
            </div>
            <h1 className="text-xl font-bold">Order Placed Successfully!</h1>
            <p className="mt-2 text-sm text-primary-400">
              Order <strong>{navState.orderNumber}</strong> is confirmed. It'll show up in My Orders shortly.
            </p>
          </>
        ) : (
          <p className="text-primary-400">Order not found.</p>
        )}
        <Link to="/orders" className="mt-4 inline-block text-accent-600 hover:underline">
          View my orders
        </Link>
      </div>
    );
  }

  const orderNumber = shipments[0].order_number;
  const total = shipments.reduce((sum, o) => sum + o.total, 0);
  const estimatedDelivery = shipments.reduce((latest, o) => (o.estimated_delivery > latest ? o.estimated_delivery : latest), shipments[0].estimated_delivery);
  const paymentMethod = shipments[0].payment_method;

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
            <span className="font-semibold">{orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-primary-400">Order Total</span>
            <span className="font-semibold">{formatCurrency(total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-primary-400">Estimated Delivery</span>
            <span className="font-semibold">{formatDate(estimatedDelivery)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-primary-400">Payment Method</span>
            <span className="font-semibold uppercase">{paymentMethod === 'cod' ? 'Cash on Delivery' : paymentMethod}</span>
          </div>
          {shipments.length > 1 && (
            <div className="flex justify-between">
              <span className="text-primary-400">Shipments</span>
              <span className="font-semibold">{shipments.length} sellers</span>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <Link to="/" className="btn-outline w-full">
            Continue Shopping
          </Link>
          <Link to="/orders" className="btn-accent w-full">
            Track Order
          </Link>
        </div>
      </div>
    </div>
  );
}
