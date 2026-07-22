import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, RotateCcw } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { useOrders } from '@/hooks/useOrders';
import { useReturns, useRequestReturn, useSimulateReturnProgress } from '@/hooks/useReturns';
import { useCart } from '@/hooks/useCart';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { OrderCard } from '@/components/orders/OrderCard';
import { ReturnCard, type EnrichedReturn } from '@/components/orders/ReturnCard';
import { OrdersToolbar, type DateFilter, type SortOrder } from '@/components/orders/OrdersToolbar';
import { RETURN_REASONS } from '@/lib/returnStatus';
import { cn } from '@/lib/utils';
import type { Order, OrderItem, OrderStatus } from '@/types';

type TabKey = 'all' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returns';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All Orders' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'returns', label: 'Returns & Refunds' },
];

const PROCESSING_STATUSES: OrderStatus[] = ['placed', 'confirmed', 'packed'];
const SHIPPED_STATUSES: OrderStatus[] = ['shipped', 'out_for_delivery'];

const DATE_FILTER_DAYS: Record<Exclude<DateFilter, 'all'>, number> = { '30d': 30, '3m': 90, '6m': 180, year: 365 };

function matchesTab(order: Order, tab: TabKey): boolean {
  switch (tab) {
    case 'all':
      return true;
    case 'processing':
      return PROCESSING_STATUSES.includes(order.status);
    case 'shipped':
      return SHIPPED_STATUSES.includes(order.status);
    case 'delivered':
      return order.status === 'delivered';
    case 'cancelled':
      return order.status === 'cancelled';
    case 'returns':
      return false;
  }
}

function withinDateFilter(iso: string, filter: DateFilter): boolean {
  if (filter === 'all') return true;
  const days = DATE_FILTER_DAYS[filter];
  return Date.now() - new Date(iso).getTime() <= days * 24 * 60 * 60 * 1000;
}

export function OrdersPage() {
  const navigate = useNavigate();
  const { data: orders, isLoading } = useOrders();
  const { data: returns, isLoading: isLoadingReturns } = useReturns();
  const { addItem } = useCart();
  const requestReturn = useRequestReturn();
  const simulateReturnProgress = useSimulateReturnProgress();

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  const [returnTarget, setReturnTarget] = useState<{ order: Order; item: OrderItem } | null>(null);
  const [returnReason, setReturnReason] = useState(RETURN_REASONS[0]);
  const [returnComment, setReturnComment] = useState('');

  const allOrders = useMemo(() => orders ?? [], [orders]);
  const searchLower = search.trim().toLowerCase();

  const visibleOrders = useMemo(() => {
    const filtered = allOrders
      .filter((o) => matchesTab(o, activeTab))
      .filter((o) => statusFilter === 'all' || o.status === statusFilter)
      .filter((o) => withinDateFilter(o.placed_at, dateFilter))
      .filter((o) => !searchLower || o.items.some((i) => i.product_name.toLowerCase().includes(searchLower)));
    return [...filtered].sort((a, b) => {
      const diff = new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime();
      return sortOrder === 'newest' ? diff : -diff;
    });
  }, [allOrders, activeTab, statusFilter, dateFilter, searchLower, sortOrder]);

  const enrichedReturns = useMemo(() => {
    const result: EnrichedReturn[] = [];
    for (const r of returns ?? []) {
      const order = allOrders.find((o) => o.id === r.order_id);
      const item = order?.items.find((i) => i.id === r.order_item_id);
      if (order && item) result.push({ returnRequest: r, order, item });
    }
    return result
      .filter((e) => !searchLower || e.item.product_name.toLowerCase().includes(searchLower))
      .filter((e) => withinDateFilter(e.returnRequest.created_at, dateFilter))
      .sort((a, b) => {
        const diff = new Date(b.returnRequest.created_at).getTime() - new Date(a.returnRequest.created_at).getTime();
        return sortOrder === 'newest' ? diff : -diff;
      });
  }, [returns, allOrders, searchLower, dateFilter, sortOrder]);

  const handleBuyAgain = async (order: Order) => {
    for (const item of order.items) {
      await addItem({ productId: item.product_id, variantId: item.variant_id, quantity: item.quantity });
    }
    navigate('/cart');
  };

  const handleOpenReturnModal = (order: Order, item: OrderItem) => {
    setReturnTarget({ order, item });
    setReturnReason(RETURN_REASONS[0]);
    setReturnComment('');
  };

  const handleSubmitReturn = async () => {
    if (!returnTarget) return;
    await requestReturn.mutateAsync({ order: returnTarget.order, orderItemId: returnTarget.item.id, reason: returnReason, comment: returnComment });
    setReturnTarget(null);
    setActiveTab('returns');
  };

  const isLoadingActive = activeTab === 'returns' ? isLoadingReturns : isLoading;

  return (
    <div>
      <Seo title="My Orders" />
      <h1 className="mb-4 text-2xl font-bold">My Orders</h1>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-primary-100 dark:border-primary-700">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'border-accent-600 text-accent-600'
                : 'border-transparent text-primary-400 hover:text-primary-700 dark:hover:text-primary-200',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <OrdersToolbar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
      />

      {isLoadingActive && (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {activeTab === 'returns' ? (
        <>
          {!isLoadingReturns && enrichedReturns.length === 0 && (
            <EmptyState
              icon={RotateCcw}
              title="No return requests"
              description="Returns you request from a delivered order will appear here."
              actionLabel="View Delivered Orders"
              actionHref="/orders"
            />
          )}
          <div className="space-y-3">
            {enrichedReturns.map((e) => (
              <ReturnCard key={e.returnRequest.id} enriched={e} onSimulateProgress={(id) => simulateReturnProgress.mutate(id)} />
            ))}
          </div>
        </>
      ) : (
        <>
          {!isLoading && visibleOrders.length === 0 && (
            <EmptyState
              icon={Package}
              title={allOrders.length === 0 ? 'No orders yet' : 'No orders match your filters'}
              description={allOrders.length === 0 ? 'When you place an order, it will show up here.' : 'Try adjusting your search, filters, or the selected tab.'}
              actionLabel="Start Shopping"
              actionHref="/"
            />
          )}
          <div className="space-y-3">
            {visibleOrders.map((order) => (
              <OrderCard key={order.id} order={order} onBuyAgain={handleBuyAgain} onRequestReturn={handleOpenReturnModal} />
            ))}
          </div>
        </>
      )}

      <Modal isOpen={Boolean(returnTarget)} onClose={() => setReturnTarget(null)} title="Return / Replace Item">
        <div className="space-y-3">
          {returnTarget && <p className="text-sm text-primary-500">{returnTarget.item.product_name}</p>}
          <div>
            <p className="mb-1.5 text-sm font-medium">Reason</p>
            <select value={returnReason} onChange={(e) => setReturnReason(e.target.value)} className="input-field">
              {RETURN_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Additional comments (optional)</p>
            <textarea value={returnComment} onChange={(e) => setReturnComment(e.target.value)} className="input-field" rows={3} />
          </div>
          <Button variant="accent" fullWidth onClick={handleSubmitReturn} isLoading={requestReturn.isPending}>
            Submit Return Request
          </Button>
        </div>
      </Modal>
    </div>
  );
}
