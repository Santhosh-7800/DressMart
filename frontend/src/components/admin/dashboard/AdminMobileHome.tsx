import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, ShoppingBag, Wallet, Package, Boxes, ChevronRight, Plus, Contact, FileBarChart } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { StatCard, StatCardSkeleton } from '@/components/admin/dashboard/StatCard';
import { SalesLast7DaysChart } from '@/components/admin/dashboard/charts/SalesTrendChart';
import { useAuth } from '@/contexts/AuthContext';
import { useAvatar } from '@/hooks/useAvatar';
import { useNotifications } from '@/hooks/useNotifications';
import { useRecentOrdersLive, useLowStockList } from '@/hooks/useDashboardData';
import { adminStatsService } from '@/services/adminStatsService';
import { queryKeys } from '@/lib/queryClient';
import { effectiveSellerId, isAdminRole } from '@/lib/roles';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { OrderStatus } from '@/types';

const ORDER_STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  placed: 'info',
  confirmed: 'info',
  packed: 'warning',
  shipped: 'warning',
  delivered: 'success',
  cancelled: 'danger',
  returned: 'danger',
};

/** Compact mobile-first Admin Home — the phone-width counterpart to the full desktop dashboard
 *  stack in AdminDashboardPage (StatGrid/QuickActions/SalesAnalyticsSection/etc., all of which stay
 *  exactly as-is for tablet/desktop). This is a *different layout*, not different data: every
 *  number below comes from the same real Firestore-backed hooks/services the desktop dashboard
 *  already uses (adminStatsService.getSellerOverview/getPlatformOverview, useRecentOrdersLive,
 *  useLowStockList) — nothing here is hardcoded or sample data. */
export function AdminMobileHome() {
  const { user } = useAuth();
  const { avatarUrl } = useAvatar();
  const { unreadCount } = useNotifications();
  const isHeadSeller = isAdminRole(user?.role);
  const sellerId = effectiveSellerId(user);

  const overviewQuery = useQuery({
    queryKey: queryKeys.admin.overview(sellerId),
    queryFn: () => adminStatsService.getSellerOverview(sellerId),
    enabled: Boolean(sellerId),
  });
  const platformQuery = useQuery({
    queryKey: queryKeys.admin.platformOverview,
    queryFn: () => adminStatsService.getPlatformOverview(),
    enabled: isHeadSeller,
  });
  const { orders: recentOrders, isLoading: ordersLoading } = useRecentOrdersLive(sellerId, isHeadSeller);
  const lowStockQuery = useLowStockList(sellerId);

  if (!user) return null;

  const metricsLoading = overviewQuery.isLoading || platformQuery.isLoading;
  const totalOrders = platformQuery.data?.totalOrders ?? overviewQuery.data?.todayOrders ?? 0;
  const totalSales = overviewQuery.data?.totalRevenue ?? 0;
  const totalProducts = overviewQuery.data?.totalProducts ?? 0;
  const activeStock = overviewQuery.data?.totalUnits ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-bold text-acc-text dark:text-white">DS LOOKS</p>
          <p className="text-xs text-acc-text-secondary">Admin Dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/admin/notifications" className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm dark:bg-card-dark" aria-label="Notifications">
            <Bell size={18} className="text-acc-text dark:text-white" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
          <Link to="/admin/settings" aria-label="Admin profile & settings">
            <Avatar src={avatarUrl} name={user.full_name} size="sm" />
          </Link>
        </div>
      </div>

      {/* Welcome */}
      <div>
        <h1 className="text-xl font-bold text-acc-text dark:text-white">
          Welcome back, <span className="text-acc-primary">{user.full_name.split(' ')[0]}</span>
        </h1>
        <p className="mt-0.5 text-sm text-acc-text-secondary">Here's what's happening with your store today.</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3">
        {metricsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard icon={ShoppingBag} label="Total Orders" value={totalOrders} to="/admin/orders" />
            <StatCard icon={Wallet} label="Total Sales" value={totalSales} to="/admin/reports" formatter={formatCurrency} />
            <StatCard icon={Package} label="Total Products" value={totalProducts} to="/admin/products" />
            <StatCard icon={Boxes} label="Active Stock" value={activeStock} to="/admin/inventory" />
          </>
        )}
      </div>

      {/* Sales Overview */}
      <SalesLast7DaysChart sellerId={sellerId} isHeadSeller={isHeadSeller} />

      {/* Recent Orders */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-acc-text-secondary">Recent Orders</h2>
          <Link to="/admin/orders" className="text-xs font-medium text-acc-primary hover:underline">
            View All
          </Link>
        </div>
        <Card hover={false} className="divide-y divide-acc-border p-0 dark:divide-primary-700">
          {ordersLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-primary-50 dark:bg-primary-800" />
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <p className="p-4 text-center text-xs text-acc-text-secondary">No orders yet.</p>
          ) : (
            recentOrders.slice(0, 4).map((order) => (
              <Link key={order.id} to="/admin/orders" className="flex items-center gap-3 p-4 hover:bg-primary-50 dark:hover:bg-primary-800">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-acc-text dark:text-white">#{order.order_number}</p>
                  <p className="mt-0.5 text-xs text-acc-text-secondary">
                    {formatDate(order.placed_at)} · {order.items.length} item{order.items.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-acc-text dark:text-white">{formatCurrency(order.total)}</p>
                  <Badge tone={ORDER_STATUS_TONE[order.status]} className="mt-1">
                    {order.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <ChevronRight size={16} className="shrink-0 text-acc-text-secondary" />
              </Link>
            ))
          )}
        </Card>
      </section>

      {/* Low Stock */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-acc-text-secondary">Low Stock</h2>
          <Link to="/admin/inventory?stock=low" className="text-xs font-medium text-acc-primary hover:underline">
            View All
          </Link>
        </div>
        <Card hover={false} className="divide-y divide-acc-border p-0 dark:divide-primary-700">
          {lowStockQuery.isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-primary-50 dark:bg-primary-800" />
              ))}
            </div>
          ) : !lowStockQuery.data || lowStockQuery.data.length === 0 ? (
            <p className="p-4 text-center text-xs text-acc-text-secondary">Nothing running low.</p>
          ) : (
            lowStockQuery.data.slice(0, 4).map(({ product }) => (
              <Link
                key={product.id}
                to={`/admin/inventory?stock=low&highlight=${product.id}`}
                className="flex items-center justify-between gap-3 p-4 hover:bg-primary-50 dark:hover:bg-primary-800"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-acc-text dark:text-white">{product.name}</p>
                  <p className="truncate text-xs text-acc-text-secondary">{product.sku}</p>
                </div>
                <Badge tone="warning">Low Stock</Badge>
              </Link>
            ))
          )}
        </Card>
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-acc-text-secondary">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { to: '/admin/products/new', label: 'Add Product', icon: Plus },
            { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
            { to: '/admin/inventory', label: 'Inventory', icon: Boxes },
            { to: '/admin/customers', label: 'Customers', icon: Contact },
            { to: '/admin/reports', label: 'Reports', icon: FileBarChart },
          ].map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to}>
              <Card className="flex flex-col items-center gap-2 py-5 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-acc-primary/10 text-acc-primary">
                  <Icon size={20} />
                </div>
                <span className="text-[11px] font-medium leading-tight text-acc-text dark:text-white">{label}</span>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
