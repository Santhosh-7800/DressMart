import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LifeBuoy, Search, ChevronRight } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAllTicketsForOwner } from '@/hooks/useSupportAdmin';
import { filterTickets, computeSupportStats, type SupportTicketFilters } from '@/lib/supportFilters';
import { formatDateTime, cn } from '@/lib/utils';
import type { SupportCategory, SupportTicketPriority, SupportTicketStatus } from '@/types';

const STATUS_TABS: { value: SupportTicketStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_for_customer', label: 'Waiting' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const CATEGORY_OPTIONS: { value: SupportCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'order', label: 'Orders' },
  { value: 'payment', label: 'Payments' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'return', label: 'Returns' },
  { value: 'exchange', label: 'Exchanges' },
  { value: 'product', label: 'Products' },
  { value: 'coupon', label: 'Coupons' },
  { value: 'account', label: 'Account' },
  { value: 'other', label: 'Other' },
];

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  in_progress: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  waiting_for_customer: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  resolved: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  closed: 'bg-primary-100 text-primary-500 dark:bg-primary-800 dark:text-primary-300',
};

const PRIORITY_BADGE: Record<SupportTicketPriority, string> = {
  low: 'bg-primary-100 text-primary-500 dark:bg-primary-800 dark:text-primary-300',
  normal: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300',
  high: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300',
};

/**
 * Section 14-16: Head-Seller-only support queue. Fetches one bounded, realtime window (see
 * useAllTicketsForOwner) and derives stats + the filtered/searched list from it client-side — the
 * same "bounded window + client filter" approach the product catalog uses, appropriate at this
 * app's realistic single-shop ticket volume and avoiding a composite index per filter combination.
 * Stats reflect only that window (most recent 300 tickets); for a single shop this is realistically
 * always the complete set.
 */
export function AdminSupportPage() {
  const { data: tickets, isLoading } = useAllTicketsForOwner();
  const [status, setStatus] = useState<SupportTicketStatus | 'all'>('all');
  const [category, setCategory] = useState<SupportCategory | 'all'>('all');
  const [search, setSearch] = useState('');

  const stats = useMemo(() => computeSupportStats(tickets ?? []), [tickets]);
  const filtered = useMemo(() => {
    const filters: SupportTicketFilters = { status, category, search };
    return filterTickets(tickets ?? [], filters).sort((a, b) => +new Date(b.last_message_at) - +new Date(a.last_message_at));
  }, [tickets, status, category, search]);

  return (
    <div className="space-y-6">
      <Seo title="Support" />
      <div className="flex items-center gap-2">
        <LifeBuoy size={20} className="text-acc-primary" />
        <h1 className="text-2xl font-bold text-acc-text dark:text-white">Customer Support</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Open', value: stats.open },
          { label: 'In Progress', value: stats.inProgress },
          { label: 'Waiting', value: stats.waiting },
          { label: 'Resolved/Closed', value: stats.resolved },
          { label: 'High Priority', value: stats.highPriority },
          { label: "Today's New", value: stats.newToday },
        ].map((s) => (
          <Card key={s.label} hover={false} className="p-4 text-center">
            <p className="text-2xl font-bold text-acc-text dark:text-white">{isLoading ? '–' : s.value}</p>
            <p className="text-xs text-acc-text-secondary">{s.label}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-acc-text-secondary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ticket ID, order ID, subject, or customer name…"
            className="input-field pl-9"
          />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value as SupportCategory | 'all')} className="input-field sm:w-56">
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              status === tab.value ? 'bg-acc-primary text-white' : 'bg-primary-100 text-primary-500 dark:bg-primary-800 dark:text-primary-300',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="No support requests match" description="Try a different filter or search term." />
      ) : (
        <div className="space-y-3">
          {filtered.map((ticket) => (
            <Link
              key={ticket.id}
              to={`/admin/support/${ticket.id}`}
              className="card-surface flex items-center gap-3 p-4 transition-colors hover:border-acc-primary"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-acc-text dark:text-white">{ticket.subject}</p>
                  {ticket.admin_unread && <span className="h-2 w-2 shrink-0 rounded-full bg-acc-primary" aria-label="Unread" />}
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', PRIORITY_BADGE[ticket.priority])}>{ticket.priority}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-acc-text-secondary">
                  {ticket.user_name} · {ticket.id.slice(0, 8)}
                  {ticket.order_id ? ` · Order ${ticket.order_id.slice(0, 8)}` : ''}
                </p>
                <p className="mt-0.5 truncate text-xs text-acc-text-secondary">{ticket.last_message_preview}</p>
                <p className="mt-1 text-xs text-acc-text-secondary">Last activity {formatDateTime(ticket.last_message_at)}</p>
              </div>
              <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', STATUS_BADGE[ticket.status])}>
                {STATUS_TABS.find((t) => t.value === ticket.status)?.label}
              </span>
              <ChevronRight size={16} className="shrink-0 text-acc-text-secondary" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
