import { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAdminOrders, useAdminReturns, useAdvanceReturn } from '@/hooks/useAdminOrders';
import { RETURN_STATUS_BADGE_CLASS, RETURN_STATUS_LABELS, nextReturnStatus } from '@/lib/returnStatus';
import { formatCurrency } from '@/lib/utils';
import type { Order } from '@/types';

/** Every customer return request, enriched with its order/item, and an action to advance its status — shared by the dedicated Returns & Refunds page and (if ever needed) an Orders sub-view. */
export function ReturnsList() {
  const { data: returns, isLoading } = useAdminReturns();
  const { data: orders } = useAdminOrders();
  const advance = useAdvanceReturn();

  const enriched = useMemo(() => {
    return (returns ?? [])
      .map((r) => {
        const order = (orders ?? []).find((o) => o.id === r.order_id);
        const item = order?.items.find((i) => i.id === r.order_item_id);
        return order && item ? { r, order, item } : null;
      })
      .filter(Boolean) as { r: NonNullable<ReturnType<typeof useAdminReturns>['data']>[number]; order: Order; item: Order['items'][number] }[];
  }, [returns, orders]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (enriched.length === 0) {
    return <EmptyState icon={RotateCcw} title="No return requests" description="Customer return requests will show up here." />;
  }

  return (
    <div className="space-y-3">
      {enriched.map(({ r, order, item }) => {
        const next = nextReturnStatus(r.status);
        return (
          <div key={r.id} className="card-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{item.product_name}</p>
                <p className="text-xs text-primary-400">
                  Order #{order.order_number} · Reason: {r.reason}
                </p>
              </div>
              <span className={RETURN_STATUS_BADGE_CLASS[r.status]}>{RETURN_STATUS_LABELS[r.status]}</span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="font-semibold">{formatCurrency(r.refund_amount)}</span>
              {next && (
                <Button variant="outline" size="sm" onClick={() => advance.mutate({ userId: r.user_id, returnId: r.id })} isLoading={advance.isPending}>
                  Advance to {RETURN_STATUS_LABELS[next]}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
