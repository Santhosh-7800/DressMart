import { useMemo } from 'react';
import { Repeat } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { useSellerExchanges, useAdvanceExchangeStatus } from '@/hooks/useExchanges';
import { useSellerOrders } from '@/hooks/useOrders';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { EXCHANGE_STATUS_BADGE_CLASS, EXCHANGE_STATUS_LABELS, nextExchangeStatus } from '@/lib/exchangeStatus';
import { formatDate, formatDateTime } from '@/lib/utils';
import type { ExchangeRequest, OrderItem } from '@/types';

export function SellerExchangesPage() {
  const { data: exchanges, isLoading } = useSellerExchanges();
  const { data: orders } = useSellerOrders();
  const advance = useAdvanceExchangeStatus();

  const itemFor = useMemo(() => {
    const byOrderId = new Map((orders ?? []).map((o) => [o.id, o]));
    return (e: ExchangeRequest): OrderItem | undefined => byOrderId.get(e.order_id)?.items.find((i) => i.id === e.order_item_id);
  }, [orders]);

  const sorted = useMemo(() => [...(exchanges ?? [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [exchanges]);

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
      <Seo title="Seller Exchanges" />
      <h1 className="mb-4 text-2xl font-bold">Exchange Requests</h1>

      {sorted.length === 0 ? (
        <EmptyState icon={Repeat} title="No exchange requests" description="Exchange requests from buyers will show up here." />
      ) : (
        <div className="space-y-3">
          {sorted.map((e) => {
            const item = itemFor(e);
            const next = nextExchangeStatus(e.status);
            return (
              <div key={e.id} className="card-surface p-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  {item && <img src={item.product_image} alt="" className="h-20 w-16 shrink-0 rounded-lg object-cover" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{item?.product_name ?? 'Order item'}</p>
                      <span className={EXCHANGE_STATUS_BADGE_CLASS[e.status]}>{EXCHANGE_STATUS_LABELS[e.status]}</span>
                    </div>
                    {item && (
                      <p className="mt-0.5 text-xs text-primary-400">
                        Current: Size {item.size} · Color {item.color} → Desired: Size {e.desired_size} · Color {e.desired_color}
                      </p>
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
                      <div>
                        <p className="text-primary-400">Requested</p>
                        <p className="font-medium">{formatDate(e.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-primary-400">Reason</p>
                        <p className="font-medium">{e.reason}</p>
                      </div>
                    </div>
                    {e.comment && <p className="mt-2 text-xs italic text-primary-400">"{e.comment}"</p>}

                    <div className="mt-3 border-t border-primary-100 pt-3 dark:border-primary-700">
                      <div className="space-y-1.5">
                        {(e.timeline ?? []).map((event, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                            <span className="font-medium">{event.label}</span>
                            <span className="text-primary-400">{formatDateTime(event.timestamp)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {e.status === 'requested' && (
                        <>
                          <Button variant="accent" size="sm" onClick={() => advance.mutate({ exchangeRequest: e, nextStatus: 'approved' })} isLoading={advance.isPending}>
                            Approve
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => advance.mutate({ exchangeRequest: e, nextStatus: 'rejected' })} isLoading={advance.isPending}>
                            Reject
                          </Button>
                        </>
                      )}
                      {next && e.status !== 'requested' && (
                        <Button variant="accent" size="sm" onClick={() => advance.mutate({ exchangeRequest: e, nextStatus: next })} isLoading={advance.isPending}>
                          Mark as {EXCHANGE_STATUS_LABELS[next]}
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
