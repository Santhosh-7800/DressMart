import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Package,
  Boxes,
  ShoppingBag,
  RotateCcw,
  Repeat,
  PackageX,
  Users,
  Wallet,
  TrendingUp,
  CalendarDays,
  CalendarRange,
  MessageSquareWarning,
  Star,
  Zap,
  UserCog,
  Ticket,
} from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { useAuth } from '@/contexts/AuthContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { isAdminRole, effectiveSellerId } from '@/lib/roles';
import { formatCurrency } from '@/lib/utils';
import { queryKeys } from '@/lib/queryClient';
import { adminStatsService } from '@/services/adminStatsService';
import { AdminMobileHome } from '@/components/admin/dashboard/AdminMobileHome';
import { DashboardHeader } from '@/components/admin/dashboard/DashboardHeader';
import { StatGrid } from '@/components/admin/dashboard/StatGrid';
import { QuickActions } from '@/components/admin/dashboard/QuickActions';
import { RecentActivityFeed } from '@/components/admin/dashboard/RecentActivityFeed';
import { StaffManagementSummary } from '@/components/admin/dashboard/StaffManagementSummary';
import { InventorySummary } from '@/components/admin/dashboard/InventorySummary';
import { OrdersStatusSummary } from '@/components/admin/dashboard/OrdersStatusSummary';
import { PaymentsSummary } from '@/components/admin/dashboard/PaymentsSummary';
import { Skeleton } from '@/components/ui/Skeleton';
import type { StatCardConfig } from '@/components/admin/dashboard/StatCard';

const SalesAnalyticsSection = lazy(() => import('@/components/admin/dashboard/SalesAnalyticsSection'));

function AnalyticsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-72 w-full rounded-[20px]" />
      ))}
    </div>
  );
}

export function AdminDashboardPage() {
  const { user } = useAuth();
  const isAdmin = isAdminRole(user?.role);
  const sellerId = effectiveSellerId(user);
  // Real conditional MOUNT (not just CSS hidden) — same pattern as ProfilePage's
  // ProfileMobileList/ProfileDesktopDashboard split, so the heavy desktop-only sections
  // (SalesAnalyticsSection's 3x chart queries, PaymentsSummary, StaffManagementSummary, the full
  // RecentActivityFeed) never mount on a phone that's only ever going to show AdminMobileHome.
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const overviewQuery = useQuery({
    queryKey: queryKeys.admin.overview(sellerId),
    queryFn: () => adminStatsService.getSellerOverview(sellerId),
    enabled: Boolean(sellerId),
  });

  const platformQuery = useQuery({
    queryKey: queryKeys.admin.platformOverview,
    queryFn: () => adminStatsService.getPlatformOverview(),
    enabled: isAdmin,
  });

  const storeCards: StatCardConfig[] | undefined = overviewQuery.data
    ? [
        { key: 'today-orders', icon: CalendarDays, label: "Today's Orders", value: overviewQuery.data.todayOrders, to: '/admin/orders' },
        { key: 'today-revenue', icon: Wallet, label: "Today's Revenue", value: overviewQuery.data.todayRevenue, to: '/admin/reports', formatter: formatCurrency },
        { key: 'month-revenue', icon: CalendarRange, label: 'Monthly Revenue', value: overviewQuery.data.monthRevenue, to: '/admin/reports', formatter: formatCurrency },
        { key: 'total-revenue', icon: TrendingUp, label: 'Total Revenue', value: overviewQuery.data.totalRevenue, to: '/admin/reports', formatter: formatCurrency },
        { key: 'total-products', icon: Package, label: 'Total Products', value: overviewQuery.data.totalProducts, to: '/admin/products' },
        { key: 'active-products', icon: Package, label: 'Active Products', value: overviewQuery.data.activeProducts, to: '/admin/products' },
        { key: 'total-variants', icon: Boxes, label: 'Total Variants', value: overviewQuery.data.totalVariants, to: '/admin/inventory' },
        { key: 'total-units', icon: Boxes, label: 'Total Units in Stock', value: overviewQuery.data.totalUnits, to: '/admin/inventory' },
        {
          key: 'out-of-stock',
          icon: PackageX,
          label: 'Out of Stock',
          value: overviewQuery.data.outOfStockProducts,
          to: '/admin/inventory?stock=out',
          tone: overviewQuery.data.outOfStockProducts > 0 ? 'warning' : 'default',
        },
        {
          key: 'low-stock',
          icon: Boxes,
          label: 'Low Stock Items',
          value: overviewQuery.data.lowStockCount,
          to: '/admin/inventory?stock=low',
          tone: overviewQuery.data.lowStockCount > 0 ? 'warning' : 'default',
        },
        { key: 'discontinued', icon: PackageX, label: 'Discontinued', value: overviewQuery.data.discontinuedProducts, to: '/admin/products' },
        {
          key: 'pending-returns',
          icon: RotateCcw,
          label: 'Pending Returns',
          value: overviewQuery.data.pendingReturns,
          to: '/admin/returns',
          tone: overviewQuery.data.pendingReturns > 0 ? 'warning' : 'default',
        },
        {
          key: 'pending-exchanges',
          icon: Repeat,
          label: 'Exchange Requests',
          value: overviewQuery.data.pendingExchanges,
          to: '/admin/exchanges',
          tone: overviewQuery.data.pendingExchanges > 0 ? 'warning' : 'default',
        },
        {
          key: 'unreplied-reviews',
          icon: MessageSquareWarning,
          label: 'Pending Reviews',
          value: overviewQuery.data.unrepliedReviews,
          to: '/admin/reviews',
          tone: overviewQuery.data.unrepliedReviews > 0 ? 'warning' : 'default',
        },
        {
          key: 'average-rating',
          icon: Star,
          label: 'Average Rating',
          value: overviewQuery.data.averageRating,
          to: '/admin/reviews',
          formatter: (n) => n.toFixed(1),
        },
        { key: 'flash-sale-products', icon: Zap, label: 'Flash Sale Products', value: overviewQuery.data.flashSaleProducts, to: '/admin/products' },
      ]
    : undefined;

  const platformCards: StatCardConfig[] | undefined = platformQuery.data
    ? [
        { key: 'platform-orders', icon: ShoppingBag, label: 'Orders (Platform-wide)', value: platformQuery.data.totalOrders, to: '/admin/analytics' },
        { key: 'platform-revenue', icon: Wallet, label: 'Total Revenue', value: platformQuery.data.totalRevenue, to: '/admin/reports', formatter: formatCurrency },
        { key: 'total-customers', icon: Users, label: 'Total Customers', value: platformQuery.data.totalCustomers, to: '/admin/customers' },
        { key: 'staff-members', icon: UserCog, label: 'Staff Members', value: platformQuery.data.staffMembers, to: '/admin/staff' },
        { key: 'coupons-active', icon: Ticket, label: 'Coupons Active', value: platformQuery.data.couponsActive, to: '/admin/coupons' },
      ]
    : undefined;

  return (
    <div className={isDesktop ? 'space-y-8' : undefined}>
      <Seo title="Admin Dashboard" />

      {!isDesktop && <AdminMobileHome />}

      {isDesktop && (
        <>
          <DashboardHeader />

          <StatGrid title="Your Store" cards={storeCards} isLoading={overviewQuery.isLoading} isError={overviewQuery.isError} skeletonCount={8} />

          <StatGrid
            title="Platform Overview"
            cards={platformCards}
            isLoading={platformQuery.isLoading}
            isError={platformQuery.isError}
            skeletonCount={7}
          />

          <QuickActions role={user?.role} />

          <Suspense fallback={<AnalyticsSkeleton />}>
            <SalesAnalyticsSection sellerId={sellerId} isHeadSeller={isAdmin} />
          </Suspense>

          <OrdersStatusSummary sellerId={sellerId} isHeadSeller={isAdmin} />

          <PaymentsSummary sellerId={sellerId} isHeadSeller={isAdmin} />

          <InventorySummary sellerId={sellerId} isHeadSeller={isAdmin} />

          <StaffManagementSummary sellerId={sellerId} />

          <RecentActivityFeed />
        </>
      )}
    </div>
  );
}
