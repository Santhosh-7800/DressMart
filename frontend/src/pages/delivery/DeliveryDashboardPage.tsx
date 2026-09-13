import { useMemo, useState } from 'react';
import { Truck, Package, MapPin, Phone, CheckCircle2, XCircle, StickyNote, AlertTriangle } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PullToRefresh } from '@/components/common/PullToRefresh';
import { useDeliveryOrders, useDeliveryAction } from '@/hooks/useDelivery';
import { DELIVERY_STATUS_LABELS } from '@/services/orderService';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import type { DeliveryStatus, Order } from '@/types';

type Bucket = 'all' | 'assigned' | 'picked_up' | 'out_for_delivery' | 'delivered' | 'failed';

const FAILURE_REASONS = ['Customer unavailable', 'Wrong address', 'Customer requested reschedule', 'Phone unreachable', 'Other'];

function bucketOf(status: DeliveryStatus | undefined): Bucket {
  if (status === 'assigned' || status === 'accepted') return 'assigned';
  if (status === 'picked_up') return 'picked_up';
  if (status === 'out_for_delivery') return 'out_for_delivery';
  if (status === 'delivered') return 'delivered';
  if (status === 'failed') return 'failed';
  return 'all';
}

function isToday(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function OrderCard({ order }: { order: Order }) {
  const action = useDeliveryAction();
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [failOpen, setFailOpen] = useState(false);
  const [failReason, setFailReason] = useState(FAILURE_REASONS[0]);
  const [failOther, setFailOther] = useState('');

  const status = order.delivery_status ?? 'unassigned';
  const codAmount = order.payment_method === 'cod' ? order.total : null;

  const handleFail = () => {
    const reason = failReason === 'Other' ? failOther.trim() : failReason;
    if (!reason) return;
    action.mutate({ orderId: order.id, action: 'failed', reason });
    setFailOpen(false);
    setFailOther('');
  };

  const handleNote = () => {
    if (!note.trim()) return;
    action.mutate({ orderId: order.id, action: 'note', note: note.trim() });
    setNoteOpen(false);
    setNote('');
  };

  return (
    <Card hover={false} className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-acc-border pb-3 dark:border-primary-700">
        <div>
          <p className="text-sm font-semibold text-acc-text dark:text-white">Order #{order.order_number}</p>
          <p className="text-xs text-acc-text-secondary">Placed {formatDateTime(order.placed_at)}</p>
        </div>
        <span className="rounded-full bg-acc-primary/10 px-3 py-1 text-xs font-semibold text-acc-primary">{DELIVERY_STATUS_LABELS[status]}</span>
      </div>

      <div className="space-y-1.5 text-sm">
        <p className="font-medium text-acc-text dark:text-white">{order.address.full_name}</p>
        <p className="flex items-center gap-1.5 text-acc-text-secondary">
          <Phone size={13} /> {order.address.phone}
        </p>
        <p className="flex items-start gap-1.5 text-acc-text-secondary">
          <MapPin size={13} className="mt-0.5 shrink-0" />
          {order.address.line1}, {order.address.line2 ? `${order.address.line2}, ` : ''}
          {order.address.city}, {order.address.state} - {order.address.pincode}
        </p>
        <p className="text-xs text-acc-text-secondary">{order.items.length} item{order.items.length > 1 ? 's' : ''}</p>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl bg-primary-50 px-3 py-2 text-sm dark:bg-primary-800/50">
        <span className="text-acc-text-secondary">{codAmount != null ? 'Cash to Collect' : 'Payment'}</span>
        <span className="font-semibold text-acc-text dark:text-white">{codAmount != null ? formatCurrency(codAmount) : order.payment_status === 'paid' ? 'Paid Online' : order.payment_status}</span>
      </div>

      {order.delivery_failure_reason && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
          <AlertTriangle size={13} /> {order.delivery_failure_reason}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-acc-border pt-3 dark:border-primary-700">
        {status === 'assigned' && (
          <Button variant="accent" size="sm" onClick={() => action.mutate({ orderId: order.id, action: 'accept' })} isLoading={action.isPending}>
            Accept Delivery
          </Button>
        )}
        {status === 'accepted' && (
          <Button variant="accent" size="sm" onClick={() => action.mutate({ orderId: order.id, action: 'picked_up' })} isLoading={action.isPending}>
            <Package size={13} /> Mark Picked Up
          </Button>
        )}
        {status === 'picked_up' && (
          <Button variant="accent" size="sm" onClick={() => action.mutate({ orderId: order.id, action: 'out_for_delivery' })} isLoading={action.isPending}>
            <Truck size={13} /> Mark Out for Delivery
          </Button>
        )}
        {status === 'out_for_delivery' && (
          <>
            <Button variant="accent" size="sm" onClick={() => action.mutate({ orderId: order.id, action: 'delivered' })} isLoading={action.isPending}>
              <CheckCircle2 size={13} /> Mark Delivered
            </Button>
            <Button variant="outline" size="sm" onClick={() => setFailOpen(true)}>
              <XCircle size={13} /> Report Failed
            </Button>
          </>
        )}
        {(status === 'assigned' || status === 'accepted' || status === 'picked_up' || status === 'out_for_delivery') && (
          <Button variant="ghost" size="sm" onClick={() => setNoteOpen(true)}>
            <StickyNote size={13} /> Add Note
          </Button>
        )}
      </div>

      <Modal isOpen={noteOpen} onClose={() => setNoteOpen(false)} title="Add Delivery Note">
        <div className="space-y-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            placeholder="e.g. Customer requested evening delivery."
            rows={3}
            className="input-field w-full resize-none"
          />
          <p className="text-right text-xs text-primary-400">{note.length}/300</p>
          <Button variant="accent" fullWidth onClick={handleNote} isLoading={action.isPending}>
            Save Note
          </Button>
        </div>
      </Modal>

      <Modal isOpen={failOpen} onClose={() => setFailOpen(false)} title="Report Failed Delivery">
        <div className="space-y-3">
          {FAILURE_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input type="radio" checked={failReason === r} onChange={() => setFailReason(r)} className="h-4 w-4 text-accent focus:ring-accent" />
              {r}
            </label>
          ))}
          {failReason === 'Other' && (
            <textarea
              value={failOther}
              onChange={(e) => setFailOther(e.target.value.slice(0, 300))}
              placeholder="Describe the reason"
              rows={2}
              className="input-field w-full resize-none"
            />
          )}
          <Button variant="accent" fullWidth onClick={handleFail} isLoading={action.isPending}>
            Submit
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

export function DeliveryDashboardPage() {
  const { data: orders, isLoading, isError, retry } = useDeliveryOrders();
  const [filter, setFilter] = useState<Bucket>('all');

  const buckets = useMemo(() => {
    const list = orders ?? [];
    return {
      assigned: list.filter((o) => bucketOf(o.delivery_status) === 'assigned'),
      picked_up: list.filter((o) => bucketOf(o.delivery_status) === 'picked_up'),
      out_for_delivery: list.filter((o) => bucketOf(o.delivery_status) === 'out_for_delivery'),
      deliveredToday: list.filter((o) => o.delivery_status === 'delivered' && isToday(o.delivery_delivered_at)),
      failed: list.filter((o) => bucketOf(o.delivery_status) === 'failed'),
    };
  }, [orders]);

  const visible = useMemo(() => {
    const list = orders ?? [];
    if (filter === 'all') return list.filter((o) => bucketOf(o.delivery_status) !== 'delivered');
    return list.filter((o) => bucketOf(o.delivery_status) === filter);
  }, [orders, filter]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-primary-50 py-16 text-center dark:bg-primary-800">
        <AlertTriangle size={24} className="text-primary-400" />
        <p className="text-sm text-acc-text-secondary">Couldn't load your deliveries. Check your connection and try again.</p>
        <Button variant="outline" size="sm" onClick={retry}>
          Retry
        </Button>
      </div>
    );
  }

  const STAT_TABS: { key: Bucket; label: string; count: number }[] = [
    { key: 'assigned', label: 'Assigned', count: buckets.assigned.length },
    { key: 'picked_up', label: 'Picked Up', count: buckets.picked_up.length },
    { key: 'out_for_delivery', label: 'Out for Delivery', count: buckets.out_for_delivery.length },
    { key: 'delivered', label: 'Delivered Today', count: buckets.deliveredToday.length },
    { key: 'failed', label: 'Failed', count: buckets.failed.length },
  ];

  return (
    <PullToRefresh onRefresh={retry}>
    <div className="space-y-6">
      <Seo title="Delivery Dashboard" />
      <h1 className="text-2xl font-bold text-acc-text dark:text-white">Delivery Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STAT_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              'rounded-2xl border p-4 text-left transition-colors',
              filter === tab.key ? 'border-acc-primary bg-acc-primary/10' : 'border-acc-border bg-white dark:border-primary-700 dark:bg-card-dark',
            )}
          >
            <p className="text-2xl font-bold text-acc-text dark:text-white">{tab.count}</p>
            <p className="text-xs text-acc-text-secondary">{tab.label}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant={filter === 'all' ? 'accent' : 'outline'} size="sm" onClick={() => setFilter('all')}>
          Active
        </Button>
        <Button variant={filter === 'delivered' ? 'accent' : 'outline'} size="sm" onClick={() => setFilter('delivered')}>
          All Delivered
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Truck} title="No deliveries here" description="Orders assigned to you will show up here." />
      ) : (
        <div className="space-y-3">
          {visible.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}
