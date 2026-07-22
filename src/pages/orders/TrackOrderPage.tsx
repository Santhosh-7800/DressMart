import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, PackageSearch } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { useOrders } from '@/hooks/useOrders';
import { EmptyState } from '@/components/ui/EmptyState';
import { OrderTrackingTimeline } from '@/components/orders/OrderTrackingTimeline';

export function TrackOrderPage() {
  const { data: orders } = useOrders();
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);

  const match = orders?.find((o) => o.order_number.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="container-app py-8">
      <Seo title="Track Order" />
      <h1 className="mb-6 text-2xl font-bold">Track Your Order</h1>

      <div className="card-surface mx-auto max-w-lg p-5">
        <label className="mb-1.5 block text-sm font-medium">Order Number</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. DM-2026-123456"
              className="input-field pl-9"
              onKeyDown={(e) => e.key === 'Enter' && setSearched(true)}
            />
          </div>
          <button onClick={() => setSearched(true)} className="btn-accent shrink-0">
            Track
          </button>
        </div>
      </div>

      {searched && !match && (
        <div className="mt-8">
          <EmptyState icon={PackageSearch} title="Order not found" description="Please check the order number and try again, or view all your orders." actionLabel="View My Orders" actionHref="/orders" />
        </div>
      )}

      {match && (
        <div className="card-surface mx-auto mt-8 max-w-3xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-semibold">Order #{match.order_number}</p>
            <Link to={`/orders/${match.id}`} className="text-sm text-accent-600 hover:underline">
              View full details
            </Link>
          </div>
          <OrderTrackingTimeline order={match} />
        </div>
      )}
    </div>
  );
}
