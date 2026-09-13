import { Link } from 'react-router-dom';
import { LifeBuoy, Plus, ChevronRight } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMyTickets } from '@/hooks/useSupport';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting_for_customer: 'Waiting on You',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  in_progress: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  waiting_for_customer: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  resolved: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  closed: 'bg-primary-100 text-primary-500 dark:bg-primary-800 dark:text-primary-300',
};

/** Customer's own support-request history (Section 10) — realtime, reached from Help Center and
 *  the account menu. */
export function SupportListPage() {
  const { data: tickets, isLoading } = useMyTickets();

  return (
    <div className="container-app py-8">
      <Seo title="My Support Requests" />
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LifeBuoy size={20} className="text-accent" />
          <h1 className="text-xl font-bold">My Support Requests</h1>
        </div>
        <Link to="/support/new">
          <Button variant="accent" size="sm">
            <Plus size={14} /> New Request
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !tickets || tickets.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="You don't have any support requests."
          description="Need help with an order, payment, or anything else? We're here for you."
          actionLabel="Create Support Request"
          actionHref="/support/new"
        />
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              to={`/support/${ticket.id}`}
              className="card-surface flex items-center gap-3 p-4 transition-colors hover:border-accent"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold">{ticket.subject}</p>
                  {ticket.customer_unread && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread reply" />}
                </div>
                <p className="mt-0.5 truncate text-xs text-primary-400">{ticket.last_message_preview}</p>
                <p className="mt-1 text-xs text-primary-400">
                  Created {formatDate(ticket.created_at)}
                  {ticket.last_message_at !== ticket.created_at && ` · Last response ${formatDate(ticket.last_message_at)}`}
                </p>
              </div>
              <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', STATUS_BADGE[ticket.status])}>
                {STATUS_LABEL[ticket.status]}
              </span>
              <ChevronRight size={16} className="shrink-0 text-primary-300" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
