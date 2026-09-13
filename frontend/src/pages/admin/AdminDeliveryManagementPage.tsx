import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Truck, Plus, KeyRound, Trash2, Ban, RotateCcw, PackageSearch, Users, AlertTriangle, XCircle } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useSellerOrders, useCancelOrder } from '@/hooks/useOrders';
import {
  useDeliveryStaffRoster,
  useAddDeliveryStaff,
  useRemoveDeliveryStaff,
  useSetDeliveryStaffStatus,
  useResetDeliveryStaffPassword,
} from '@/hooks/useDelivery';
import { AssignDeliveryModal } from '@/components/admin/AssignDeliveryModal';
import { DELIVERY_STATUS_LABELS } from '@/services/orderService';
import { getFriendlyErrorMessage } from '@/lib/firebaseErrors';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import type { DeliveryStatus, Order, Profile } from '@/types';

type Tab = 'orders' | 'personnel';

// Orders in this range are the ones a delivery assignment is ever relevant for — before 'packed'
// there's nothing to hand off yet, and past 'out_for_delivery' it's either delivered or cancelled.
const ASSIGNABLE_STATUSES = ['packed', 'shipped', 'out_for_delivery'];

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card hover={false} className="p-4">
      <p className="text-2xl font-bold text-acc-text dark:text-white">{value}</p>
      <p className="text-xs text-acc-text-secondary">{label}</p>
    </Card>
  );
}

function OrdersTab() {
  const { data: orders, isLoading } = useSellerOrders();
  const { data: roster } = useDeliveryStaffRoster();
  const cancelOrder = useCancelOrder();
  const [assignTarget, setAssignTarget] = useState<Order | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [filter, setFilter] = useState<'pending' | DeliveryStatus | 'all'>('pending');

  const visible = useMemo(() => {
    const list = (orders ?? []).filter((o) => ASSIGNABLE_STATUSES.includes(o.status));
    const filtered = filter === 'all' ? list : filter === 'pending' ? list.filter((o) => !o.delivery_staff_id) : list.filter((o) => (o.delivery_status ?? 'unassigned') === filter);
    // Failed deliveries are a review queue (Section 15) — most recently failed first, so the owner
    // sees what needs attention right now rather than the oldest failure buried at the bottom.
    if (filter === 'failed') {
      return [...filtered].sort((a, b) => new Date(b.delivery_failed_at ?? 0).getTime() - new Date(a.delivery_failed_at ?? 0).getTime());
    }
    return filtered;
  }, [orders, filter]);

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(['pending', 'assigned', 'out_for_delivery', 'delivered', 'failed', 'all'] as const).map((f) => (
          <Button key={f} variant={filter === f ? 'accent' : 'outline'} size="sm" onClick={() => setFilter(f)}>
            {f === 'pending' ? 'Pending Assignment' : f === 'all' ? 'All' : DELIVERY_STATUS_LABELS[f as DeliveryStatus]}
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={PackageSearch} title="No orders here" description="Orders ready for delivery assignment will show up here." />
      ) : (
        <div className="space-y-3">
          {visible.map((order) => (
            <div key={order.id} className="card-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Order #{order.order_number}</p>
                  <p className="text-xs text-primary-400">{order.address.full_name} · {formatDateTime(order.placed_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="badge-accent">{DELIVERY_STATUS_LABELS[order.delivery_status ?? 'unassigned']}</span>
                  <span className="font-semibold">{formatCurrency(order.total)}</span>
                </div>
              </div>
              {order.delivery_staff_name && <p className="mt-2 text-xs text-primary-400">Assigned to: {order.delivery_staff_name}</p>}
              {order.delivery_status === 'failed' && order.delivery_failure_reason && (
                <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>
                    <span className="font-semibold">Delivery failed:</span> {order.delivery_failure_reason}
                    {order.delivery_failed_at && ` · ${formatDateTime(order.delivery_failed_at)}`}
                  </span>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-primary-100 pt-3 dark:border-primary-700">
                <Button variant="outline" size="sm" onClick={() => setAssignTarget(order)}>
                  {order.delivery_staff_id ? 'Reassign' : 'Assign Delivery'}
                </Button>
                {order.delivery_status === 'failed' && (
                  <Button variant="danger" size="sm" onClick={() => setCancelTarget(order)}>
                    <XCircle size={13} /> Cancel Order
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AssignDeliveryModal order={assignTarget} roster={roster ?? []} onClose={() => setAssignTarget(null)} />

      <Modal isOpen={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} title="Cancel this order?">
        <p className="mb-4 text-sm text-primary-500 dark:text-primary-300">
          Order #{cancelTarget?.order_number} failed delivery{cancelTarget?.delivery_failure_reason ? ` (${cancelTarget.delivery_failure_reason})` : ''}. Cancelling restocks its
          items and notifies the customer. This cannot be undone — to try again instead, close this and use Reassign.
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

const BLANK_FORM = { fullName: '', email: '', phone: '' };

function PersonnelTab() {
  const { data: roster, isLoading } = useDeliveryStaffRoster();
  const { data: orders } = useSellerOrders();
  const addStaff = useAddDeliveryStaff();
  const removeStaff = useRemoveDeliveryStaff();
  const setStatus = useSetDeliveryStaffStatus();
  const resetPassword = useResetDeliveryStaffPassword();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [removeTarget, setRemoveTarget] = useState<Profile | null>(null);

  const workload = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of orders ?? []) {
      if (!o.delivery_staff_id) continue;
      const active = ['assigned', 'accepted', 'picked_up', 'out_for_delivery'].includes(o.delivery_status ?? '');
      if (active) counts.set(o.delivery_staff_id, (counts.get(o.delivery_staff_id) ?? 0) + 1);
    }
    return counts;
  }, [orders]);

  /** Per-person delivered/failed counts + average completion time (Phase 18 Section 25) — every
   *  order still carries which delivery_staff_id handled it even after completion, so this is a
   *  plain group-by over the same already-fetched order list `workload` uses, no new query. Average
   *  completion time only counts orders with BOTH real timestamps present and is shown as "—" (never
   *  0) when a person has no such deliveries yet, matching the "don't fabricate a metric" rule the
   *  page's own top-level Avg. Delivery Time stat already established. */
  const performance = useMemo(() => {
    const stats = new Map<string, { delivered: number; failed: number; hours: number[] }>();
    for (const o of orders ?? []) {
      if (!o.delivery_staff_id) continue;
      const row = stats.get(o.delivery_staff_id) ?? { delivered: 0, failed: 0, hours: [] };
      if (o.delivery_status === 'delivered') {
        row.delivered += 1;
        if (o.delivery_assigned_at && o.delivery_delivered_at) {
          const hrs = (new Date(o.delivery_delivered_at).getTime() - new Date(o.delivery_assigned_at).getTime()) / 3_600_000;
          if (hrs >= 0) row.hours.push(hrs);
        }
      } else if (o.delivery_status === 'failed') {
        row.failed += 1;
      }
      stats.set(o.delivery_staff_id, row);
    }
    return stats;
  }, [orders]);

  const handleAdd = () => {
    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim()) {
      toast.error('Full name, email, and phone are required.');
      return;
    }
    addStaff.mutate(
      { fullName: form.fullName.trim(), email: form.email.trim(), phone: form.phone.trim() },
      { onSuccess: () => { setIsAddOpen(false); setForm(BLANK_FORM); } },
    );
  };

  const handleRemove = () => {
    if (!removeTarget) return;
    removeStaff.mutate(removeTarget.id, {
      onSuccess: () => setRemoveTarget(null),
      onError: (error) => toast.error(getFriendlyErrorMessage(error, 'Could not remove this delivery person.')),
    });
  };

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="account" onClick={() => setIsAddOpen(true)}>
          <Plus size={15} /> Add Delivery Person
        </Button>
      </div>

      {!roster || roster.length === 0 ? (
        <EmptyState icon={Users} title="No delivery personnel yet" description="Add your first delivery person to start assigning orders." />
      ) : (
        <div className="space-y-3">
          {roster.map((person) => {
            const isActive = person.delivery_staff_status !== 'inactive';
            const perf = performance.get(person.id);
            const avgHours = perf && perf.hours.length > 0 ? perf.hours.reduce((s, h) => s + h, 0) / perf.hours.length : null;
            return (
              <div key={person.id} className="card-surface flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-semibold">{person.full_name}</p>
                  <p className="text-xs text-primary-400">{person.email} · {person.phone}</p>
                  <p className="mt-1 text-xs text-primary-400">Active deliveries: {workload.get(person.id) ?? 0}</p>
                  <p className="mt-0.5 text-xs text-primary-400">
                    Delivered: {perf?.delivered ?? 0} · Failed: {perf?.failed ?? 0} · Avg time: {avgHours === null ? '—' : `${avgHours.toFixed(1)}h`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', isActive ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300')}>
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStatus.mutate({ deliveryStaffId: person.id, status: isActive ? 'inactive' : 'active', reason: isActive ? 'Deactivated by Head Seller' : null })}
                  >
                    {isActive ? <Ban size={13} /> : <RotateCcw size={13} />} {isActive ? 'Deactivate' : 'Reactivate'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => resetPassword.mutate(person.id)}>
                    <KeyRound size={13} />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setRemoveTarget(person)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Delivery Person">
        <div className="space-y-4">
          <Input floating label="Full Name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <Input floating label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input floating label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div className="flex gap-3">
            <Button variant="outline" fullWidth onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button variant="account" fullWidth onClick={handleAdd} isLoading={addStaff.isPending}>
              Add
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(removeTarget)} onClose={() => setRemoveTarget(null)} title={`Remove ${removeTarget?.full_name ?? ''}`}>
        <div className="space-y-4">
          <p className="text-sm text-primary-500 dark:text-primary-300">
            This permanently deletes their account. If they have an active delivery in progress, this will be blocked — deactivate instead.
          </p>
          <Button variant="danger" fullWidth onClick={handleRemove} isLoading={removeStaff.isPending}>
            Remove Permanently
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export function AdminDeliveryManagementPage() {
  const { data: orders } = useSellerOrders();
  const [tab, setTab] = useState<Tab>('orders');

  const stats = useMemo(() => {
    const all = orders ?? [];
    // Assignment-relevant orders only (pending/assigned/out-for-delivery/failed) — an order whose
    // delivery already completed has order.status advanced to 'delivered', which falls OUTSIDE
    // ASSIGNABLE_STATUSES; "Delivered Today" and "COD Collected Today" below deliberately compute
    // over the FULL `all` list instead (a bug found during Phase 17's audit: computing them over
    // this narrower `list` made "Delivered Today" permanently read 0, since a delivered order can
    // never appear in a list already filtered to non-delivered statuses).
    const list = all.filter((o) => ASSIGNABLE_STATUSES.includes(o.status));
    const today = new Date();
    const isToday = (iso?: string | null) => {
      if (!iso) return false;
      const d = new Date(iso);
      return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
    };

    const deliveredToday = all.filter((o) => o.delivery_status === 'delivered' && isToday(o.delivery_delivered_at));
    const codCollectedToday = deliveredToday.filter((o) => o.payment_method === 'cod').reduce((sum, o) => sum + o.total, 0);

    // Average time from assignment to delivery, across every order with both real timestamps —
    // only computed from actual data, never estimated, and shown as "—" (not 0 or NaN) when no
    // delivery has both timestamps yet (Section 26: "do not calculate misleading metrics if
    // timestamps are incomplete").
    const completionHours = all
      .filter((o) => o.delivery_status === 'delivered' && o.delivery_assigned_at && o.delivery_delivered_at)
      .map((o) => (new Date(o.delivery_delivered_at!).getTime() - new Date(o.delivery_assigned_at!).getTime()) / 3_600_000)
      .filter((hrs) => hrs >= 0);
    const avgCompletionHours = completionHours.length > 0 ? completionHours.reduce((sum, h) => sum + h, 0) / completionHours.length : null;

    return {
      pending: list.filter((o) => !o.delivery_staff_id).length,
      assigned: list.filter((o) => ['assigned', 'accepted'].includes(o.delivery_status ?? '')).length,
      outForDelivery: list.filter((o) => o.delivery_status === 'out_for_delivery').length,
      deliveredToday: deliveredToday.length,
      failed: list.filter((o) => o.delivery_status === 'failed').length,
      codCollectedToday,
      avgCompletionLabel: avgCompletionHours === null ? '—' : avgCompletionHours < 1 ? `${Math.round(avgCompletionHours * 60)}m` : `${avgCompletionHours.toFixed(1)}h`,
    };
  }, [orders]);

  return (
    <div className="space-y-6">
      <Seo title="Delivery Management" />
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Truck size={22} className="text-acc-primary" /> Delivery Management
      </h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Pending Assignment" value={stats.pending} />
        <StatCard label="Assigned" value={stats.assigned} />
        <StatCard label="Out for Delivery" value={stats.outForDelivery} />
        <StatCard label="Delivered Today" value={stats.deliveredToday} />
        <StatCard label="Failed" value={stats.failed} />
        <StatCard label="Avg. Delivery Time" value={stats.avgCompletionLabel} />
        <StatCard label="COD Collected Today" value={formatCurrency(stats.codCollectedToday)} />
      </div>

      <div className="flex gap-2 border-b border-acc-border dark:border-primary-700">
        <button
          onClick={() => setTab('orders')}
          className={cn('border-b-2 px-4 py-2 text-sm font-medium', tab === 'orders' ? 'border-acc-primary text-acc-primary' : 'border-transparent text-acc-text-secondary')}
        >
          Orders
        </button>
        <button
          onClick={() => setTab('personnel')}
          className={cn('border-b-2 px-4 py-2 text-sm font-medium', tab === 'personnel' ? 'border-acc-primary text-acc-primary' : 'border-transparent text-acc-text-secondary')}
        >
          Personnel
        </button>
      </div>

      {tab === 'orders' ? <OrdersTab /> : <PersonnelTab />}
    </div>
  );
}
