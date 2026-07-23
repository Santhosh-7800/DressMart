import { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { useSellerReturns, useAdvanceReturnStatus } from '@/hooks/useReturns';
import { useSellerOrders } from '@/hooks/useOrders';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { RETURN_STATUS_BADGE_CLASS, RETURN_STATUS_LABELS, nextReturnStatus } from '@/lib/returnStatus';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import type { OrderItem, ReturnRequest } from '@/types';

export function SellerReturnsPage() {
  const { data: returns, isLoading } = useSellerReturns();
  const { data: orders } = useSellerOrders();
  const advance = useAdvanceReturnStatus();

  const itemFor = useMemo(() => {
    const byOrderId = new Map((orders ?? []).map((o) => [o.id, o]));
    return (r: ReturnRequest): OrderItem | undefined => byOrderId.get(r.order_id)?.items.find((i) => i.id === r.order_item_id);
  }, [orders]);

  const sorted = useMemo(() => [...(returns ?? [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [returns]);

  if (isLoading) {
    return (
      <div className="container-app py-8 space-y-3">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="container-app py-8">
      <Seo title="Seller Returns" />
      <h1 className="mb-4 text-2xl font-bold">Return Requests</h1>

      {sorted.length === 0 ? (
        <EmptyState icon={RotateCcw} title="No return requests" description="Return requests from buyers will show up here." />
      ) : (
        <div className="space-y-3">
          {sorted.map((r) => {
            const item = itemFor(r);
            const next = nextReturnStatus(r.status);
            return (
              <div key={r.id} className="card-surface p-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  {item && <img src={item.product_image} alt="" className="h-20 w-16 shrink-0 rounded-lg object-cover" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{item?.product_name ?? 'Order item'}</p>
                      <span className={RETURN_STATUS_BADGE_CLASS[r.status]}>{RETURN_STATUS_LABELS[r.status]}</span>
                    </div>
                    {item && (
                      <p className="mt-0.5 text-xs text-primary-400">
                        Size: {item.size} · Color: {item.color} · Qty: {item.quantity}
                      </p>
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
                      <div>
                        <p className="text-primary-400">Requested</p>
                        <p className="font-medium">{formatDate(r.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-primary-400">Reason</p>
                        <p className="font-medium">{r.reason}</p>
                      </div>
                      <div>
                        <p className="text-primary-400">Refund Amount</p>
                        <p className="font-medium">{formatCurrency(r.refund_amount)}</p>
                      </div>
                    </div>
                    {r.comment && <p className="mt-2 text-xs italic text-primary-400">"{r.comment}"</p>}

                    <div className="mt-3 border-t border-primary-100 pt-3 dark:border-primary-700">
                      <div className="space-y-1.5">
                        {(r.timeline ?? []).map((event, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                            <span className="font-medium">{event.label}</span>
                            <span className="text-primary-400">{formatDateTime(event.timestamp)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {r.status === 'requested' && (
                        <>
                          <Button variant="accent" size="sm" onClick={() => advance.mutate({ returnRequest: r, nextStatus: 'approved' })} isLoading={advance.isPending}>
                            Approve
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => advance.mutate({ returnRequest: r, nextStatus: 'rejected' })} isLoading={advance.isPending}>
                            Reject
                          </Button>
                        </>
                      )}
                      {next && r.status !== 'requested' && (
                        <Button variant="accent" size="sm" onClick={() => advance.mutate({ returnRequest: r, nextStatus: next })} isLoading={advance.isPending}>
                          Mark as {RETURN_STATUS_LABELS[next]}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
