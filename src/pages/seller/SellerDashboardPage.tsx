import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Package, Boxes, ShoppingBag, RotateCcw, Repeat, AlertTriangle, Users, Clock, Wallet, TrendingUp } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { isHeadSeller } from '@/lib/roles';
import { formatCurrency } from '@/lib/utils';
import { queryKeys } from '@/lib/queryClient';
import { sellerStatsService } from '@/services/sellerStatsService';

function StatCard({ icon: Icon, label, value, to, tone = 'default' }: { icon: LucideIcon; label: string; value: string | number; to?: string; tone?: 'default' | 'warning' }) {
  const content = (
    <Card hover={Boolean(to)} className="flex items-center gap-4">
      <div
        className={
          tone === 'warning'
            ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
            : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acc-primary/10 text-acc-primary'
        }
      >
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-acc-text dark:text-white">{value}</p>
        <p className="truncate text-xs text-acc-text-secondary">{label}</p>
      </div>
    </Card>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

function StatCardSkeleton() {
  return (
    <Card hover={false} className="flex items-center gap-4">
      <Skeleton className="h-11 w-11 rounded-2xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-3 w-24" />
      </div>
    </Card>
  );
}

export function SellerDashboardPage() {
  const { user } = useAuth();
  const headSeller = isHeadSeller(user?.role);

  const overviewQuery = useQuery({
    queryKey: queryKeys.seller.overview(user?.id ?? ''),
    queryFn: () => sellerStatsService.getSellerOverview(user!.id),
    enabled: Boolean(user?.id),
  });

  const platformQuery = useQuery({
    queryKey: queryKeys.seller.platformOverview,
    queryFn: () => sellerStatsService.getPlatformOverview(),
    enabled: headSeller,
  });

  return (
    <div className="space-y-8">
      <Seo title="Seller Dashboard" />
      <div>
        <h1 className="text-2xl font-bold text-acc-text dark:text-white">
          Welcome back{user?.store_name ? `, ${user.store_name}` : ''}
        </h1>
        <p className="mt-1 text-sm text-acc-text-secondary">Here's how your store is doing.</p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-acc-text-secondary">Your Store</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {overviewQuery.isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : overviewQuery.data ? (
            <>
              <StatCard icon={Package} label="Active Products" value={overviewQuery.data.activeProducts} to="/seller/products" />
              <StatCard icon={Package} label="Total Products" value={overviewQuery.data.totalProducts} to="/seller/products" />
              <StatCard
                icon={Boxes}
                label="Low Stock Items"
                value={overviewQuery.data.lowStockCount}
                to="/seller/inventory"
                tone={overviewQuery.data.lowStockCount > 0 ? 'warning' : 'default'}
              />
              <StatCard icon={ShoppingBag} label="Orders (30 days)" value={overviewQuery.data.ordersLast30Days} to="/seller/orders" />
              <StatCard icon={ShoppingBag} label="Total Orders" value={overviewQuery.data.totalOrders} to="/seller/orders" />
              <StatCard
                icon={RotateCcw}
                label="Pending Returns"
                value={overviewQuery.data.pendingReturns}
                to="/seller/returns"
                tone={overviewQuery.data.pendingReturns > 0 ? 'warning' : 'default'}
              />
              <StatCard
                icon={Repeat}
                label="Pending Exchanges"
                value={overviewQuery.data.pendingExchanges}
                to="/seller/exchanges"
                tone={overviewQuery.data.pendingExchanges > 0 ? 'warning' : 'default'}
              />
            </>
          ) : (
            <Card hover={false} className="col-span-full flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle size={16} /> Couldn't load your store stats. Try refreshing.
            </Card>
          )}
        </div>
      </section>

      {headSeller && (
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-acc-text-secondary">Platform Overview</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {platformQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
            ) : platformQuery.data ? (
              <>
                <StatCard icon={Users} label="Total Sellers" value={platformQuery.data.totalSellers} to="/seller/sellers" />
                <StatCard
                  icon={Clock}
                  label="Pending Applications"
                  value={platformQuery.data.pendingApplications}
                  to="/seller/sellers"
                  tone={platformQuery.data.pendingApplications > 0 ? 'warning' : 'default'}
                />
                <StatCard icon={TrendingUp} label="Orders (Platform-wide)" value={platformQuery.data.totalOrders} to="/seller/analytics" />
                <StatCard icon={Wallet} label="Total Revenue" value={formatCurrency(platformQuery.data.totalRevenue)} to="/seller/reports" />
              </>
            ) : (
              <Card hover={false} className="col-span-full flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertTriangle size={16} /> Couldn't load platform stats. Try refreshing.
              </Card>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
