import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ShoppingBag, RotateCcw, Repeat, MessageSquare, Bell, Users, UserCog } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { isHeadSeller, effectiveSellerId } from '@/lib/roles';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { STATUS_LABELS } from '@/services/orderService';
import { RETURN_STATUS_LABELS } from '@/lib/returnStatus';
import { EXCHANGE_STATUS_LABELS } from '@/lib/exchangeStatus';
import {
  useRecentOrdersLive,
  useRecentReturns,
  useRecentExchanges,
  useRecentReviews,
  useLatestSellerRegistrations,
  useLatestStaffActivity,
} from '@/hooks/useDashboardData';

interface FeedRow {
  id: string;
  primary: string;
  secondary: string;
  timestamp: string;
  badgeLabel?: string;
  badgeTone?: BadgeTone;
}

function FeedCard({
  title,
  icon: Icon,
  rows,
  isLoading,
  emptyLabel,
  viewAllHref,
}: {
  title: string;
  icon: LucideIcon;
  rows: FeedRow[] | undefined;
  isLoading: boolean;
  emptyLabel: string;
  viewAllHref: string;
}) {
  return (
    <Card hover={false} className="flex flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-acc-text dark:text-white">
          <Icon size={16} className="text-acc-primary" /> {title}
        </h3>
        <Link to={viewAllHref} className="text-xs font-medium text-acc-primary hover:underline">
          View all
        </Link>
      </div>
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !rows || rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-acc-text-secondary">{emptyLabel}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-3 border-b border-acc-border pb-3 last:border-0 last:pb-0 dark:border-primary-700">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-acc-text dark:text-white">{row.primary}</p>
                <p className="truncate text-xs text-acc-text-secondary">{row.secondary}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {row.badgeLabel && <Badge tone={row.badgeTone}>{row.badgeLabel}</Badge>}
                <span className="text-[11px] text-acc-text-secondary">{formatDateTime(row.timestamp)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function RecentActivityFeed() {
  const { user } = useAuth();
  const headSeller = isHeadSeller(user?.role);
  const sellerId = effectiveSellerId(user);

  const { orders, isLoading: ordersLoading } = useRecentOrdersLive(sellerId, headSeller);
  const returnsQuery = useRecentReturns(sellerId, headSeller);
  const exchangesQuery = useRecentExchanges(sellerId, headSeller);
  const reviewsQuery = useRecentReviews(sellerId);
  const notifications = useNotifications();
  const registrationsQuery = useLatestSellerRegistrations(headSeller);
  const staffActivityQuery = useLatestStaffActivity(sellerId, headSeller);

  return (
    <section>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-acc-text-secondary">Recent Activity</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <FeedCard
          title="Recent Orders"
          icon={ShoppingBag}
          isLoading={ordersLoading}
          emptyLabel="No orders yet."
          viewAllHref="/seller/orders"
          rows={orders.map((o) => ({
            id: o.id,
            primary: `${o.order_number} — ${formatCurrency(o.total)}`,
            secondary: `${o.items.length} item${o.items.length === 1 ? '' : 's'}`,
            timestamp: o.placed_at,
            badgeLabel: STATUS_LABELS[o.status],
            badgeTone: o.status === 'delivered' ? 'success' : o.status === 'cancelled' ? 'danger' : 'info',
          }))}
        />

        <FeedCard
          title="Recent Returns"
          icon={RotateCcw}
          isLoading={returnsQuery.isLoading}
          emptyLabel="No return requests."
          viewAllHref="/seller/returns"
          rows={returnsQuery.data?.map((r) => ({
            id: r.id,
            primary: r.reason,
            secondary: formatCurrency(r.refund_amount),
            timestamp: r.created_at,
            badgeLabel: RETURN_STATUS_LABELS[r.status],
            badgeTone: r.status === 'refunded' ? 'success' : r.status === 'rejected' ? 'danger' : 'info',
          }))}
        />

        <FeedCard
          title="Recent Exchanges"
          icon={Repeat}
          isLoading={exchangesQuery.isLoading}
          emptyLabel="No exchange requests."
          viewAllHref="/seller/exchanges"
          rows={exchangesQuery.data?.map((x) => ({
            id: x.id,
            primary: x.reason,
            secondary: `Wants: ${x.desired_size} / ${x.desired_color}`,
            timestamp: x.created_at,
            badgeLabel: EXCHANGE_STATUS_LABELS[x.status],
            badgeTone: x.status === 'exchanged' ? 'success' : x.status === 'rejected' ? 'danger' : 'info',
          }))}
        />

        <FeedCard
          title="Recent Reviews"
          icon={MessageSquare}
          isLoading={reviewsQuery.isLoading}
          emptyLabel="No reviews yet."
          viewAllHref="/seller/reviews"
          rows={reviewsQuery.data?.map((r) => ({
            id: r.id,
            primary: r.product_name,
            secondary: r.review_text || `${r.rating}-star review by ${r.user_name}`,
            timestamp: r.created_at,
            badgeLabel: r.seller_reply ? 'Replied' : 'Awaiting reply',
            badgeTone: r.seller_reply ? 'success' : 'warning',
          }))}
        />

        <FeedCard
          title="Latest Notifications"
          icon={Bell}
          isLoading={notifications.isLoading}
          emptyLabel="No notifications."
          viewAllHref="/seller/notifications"
          rows={notifications.notifications.slice(0, 5).map((n) => ({
            id: n.id,
            primary: n.title,
            secondary: n.message,
            timestamp: n.created_at,
            badgeLabel: n.is_read ? undefined : 'New',
            badgeTone: 'warning',
          }))}
        />

        {headSeller && (
          <FeedCard
            title="Latest Seller Registrations"
            icon={Users}
            isLoading={registrationsQuery.isLoading}
            emptyLabel="No seller applications yet."
            viewAllHref="/seller/sellers"
            rows={registrationsQuery.data?.map((r) => ({
              id: r.id,
              primary: r.store_name,
              secondary: `${r.full_name} — ${r.email}`,
              timestamp: r.applied_at,
              badgeLabel: r.status,
              badgeTone: r.status === 'approved' ? 'success' : r.status === 'rejected' || r.status === 'suspended' ? 'danger' : 'warning',
            }))}
          />
        )}

        {headSeller && (
          <FeedCard
            title="Latest Staff Activity"
            icon={UserCog}
            isLoading={staffActivityQuery.isLoading}
            emptyLabel="No staff activity yet."
            viewAllHref="/seller/staff"
            rows={staffActivityQuery.data?.map((a) => ({
              id: a.id,
              primary: a.staff_name,
              secondary: `${a.action.replace(/_/g, ' ')}${a.target_label ? ` — ${a.target_label}` : ''}`,
              timestamp: a.created_at,
            }))}
          />
        )}
      </div>
    </section>
  );
}
