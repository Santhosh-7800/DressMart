import { Bell, Package, CreditCard, Truck, RotateCcw, Repeat, XCircle, AlertTriangle, Store, Megaphone, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Seo } from '@/components/common/Seo';
import { useNotifications } from '@/hooks/useNotifications';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateTime, cn } from '@/lib/utils';
import type { NotificationType } from '@/types';

const ICONS: Record<NotificationType, LucideIcon> = {
  order: Package,
  payment: CreditCard,
  delivery: Truck,
  return: RotateCcw,
  exchange: Repeat,
  new_order: Package,
  cancelled_order: XCircle,
  low_stock: AlertTriangle,
  seller_registration: Store,
  platform: Megaphone,
};

/** Same underlying notificationService/useNotifications as the buyer's NotificationsPage — the
 *  service is already role-agnostic (keyed on the signed-in user's own uid), so this is just a
 *  seller-shell-styled presentation of the exact same data. Route: /seller/notifications. */
export function SellerNotificationsPage() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  return (
    <div>
      <Seo title="Seller — Notifications" />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-acc-text dark:text-white">
          Notifications {unreadCount > 0 && <span className="text-base font-normal text-acc-text-secondary">({unreadCount} unread)</span>}
        </h1>
        {unreadCount > 0 && (
          <button onClick={() => markAllRead()} className="text-sm text-accent-600 hover:underline">
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="You're all caught up!" />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = ICONS[n.type];
            const content = (
              <div className={cn('card-surface flex gap-3 p-4', !n.is_read && 'ring-1 ring-accent')}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-700">
                  <Icon size={18} className="text-primary-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="text-sm text-primary-500">{n.message}</p>
                  <p className="mt-1 text-xs text-primary-400">{formatDateTime(n.created_at)}</p>
                </div>
                {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />}
              </div>
            );
            return n.link ? (
              <Link key={n.id} to={n.link} onClick={() => !n.is_read && markRead(n.id)}>
                {content}
              </Link>
            ) : (
              <button key={n.id} onClick={() => !n.is_read && markRead(n.id)} className="block w-full text-left">
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
