import { Link } from 'react-router-dom';
import { Download, HelpCircle } from 'lucide-react';
import type { ExchangeRequest, Order, OrderItem } from '@/types';
import { Button } from '@/components/ui/Button';
import { formatDate, formatDateTime } from '@/lib/utils';
import { downloadInvoice } from '@/lib/invoice';
import { EXCHANGE_STATUS_BADGE_CLASS, EXCHANGE_STATUS_LABELS } from '@/lib/exchangeStatus';

export interface EnrichedExchange {
  exchangeRequest: ExchangeRequest;
  order: Order;
  item: OrderItem;
}

interface ExchangeCardProps {
  enriched: EnrichedExchange;
}

export function ExchangeCard({ enriched }: ExchangeCardProps) {
  const { exchangeRequest: e, order, item } = enriched;

  return (
    <div className="card-surface p-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <img src={item.product_image} alt="" className="h-20 w-16 shrink-0 rounded-lg object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{item.product_name}</p>
            <span className={EXCHANGE_STATUS_BADGE_CLASS[e.status]}>{EXCHANGE_STATUS_LABELS[e.status]}</span>
          </div>
          <p className="text-xs text-primary-400">{item.brand_name || 'DressMart'}</p>
          <p className="mt-0.5 text-xs text-primary-400">
            Current: Size {item.size} · Color {item.color} → Desired: Size {e.desired_size} · Color {e.desired_color}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
            <div>
              <p className="text-primary-400">Order Date</p>
              <p className="font-medium">{formatDate(order.placed_at)}</p>
            </div>
            <div>
              <p className="text-primary-400">Exchange Requested</p>
              <p className="font-medium">{formatDate(e.created_at)}</p>
            </div>
            <div>
              <p className="text-primary-400">Reason</p>
              <p className="font-medium">{e.reason}</p>
            </div>
          </div>

          {e.comment && <p className="mt-2 text-xs italic text-primary-400">"{e.comment}"</p>}

          <div className="mt-3 border-t border-primary-100 pt-3 dark:border-primary-700">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary-400">Timeline</p>
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
            <Button variant="outline" size="sm" onClick={() => downloadInvoice(order)}>
              <Download size={13} /> Download Invoice
            </Button>
            <Link to="/help-center" className="btn-outline !px-3 !py-1.5 text-xs">
              <HelpCircle size={13} /> Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
