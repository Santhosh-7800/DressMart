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
  Clock,
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
import { isHeadSeller, effectiveSellerId } from '@/lib/roles';
import { formatCurrency } from '@/lib/utils';
import { queryKeys } from '@/lib/queryClient';
import { sellerStatsService } from '@/services/sellerStatsService';
import { DashboardHeader } from '@/components/seller/dashboard/DashboardHeader';
import { StatGrid } from '@/components/seller/dashboard/StatGrid';
import { QuickActions } from '@/components/seller/dashboard/QuickActions';
import { RecentActivityFeed } from '@/components/seller/dashboard/RecentActivityFeed';
import { SellerManagementSummary } from '@/components/seller/dashboard/SellerManagementSummary';
import { StaffManagementSummary } from '@/components/seller/dashboard/StaffManagementSummary';
import { InventorySummary } from '@/components/seller/dashboard/InventorySummary';
import { OrdersStatusSummary } from '@/components/seller/dashboard/OrdersStatusSummary';
import { PaymentsSummary } from '@/components/seller/dashboard/PaymentsSummary';
import { Skeleton } from '@/components/ui/Skeleton';
import type { StatCardConfig } from '@/components/seller/dashboard/StatCard';

const SalesAnalyticsSection = lazy(() => import('@/components/seller/dashboard/SalesAnalyticsSection'));

function AnalyticsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-72 w-full rounded-[20px]" />
      ))}
    </div>
  );
}

export function SellerDashboardPage() {
  const { user } = useAuth();
  const headSeller = isHeadSeller(user?.role);
  const sellerId = effectiveSellerId(user);

  const overviewQuery = useQuery({
    queryKey: queryKeys.seller.overview(sellerId),
    queryFn: () => sellerStatsService.getSellerOverview(sellerId),
    enabled: Boolean(sellerId),
  });

  const platformQuery = useQuery({
    queryKey: queryKeys.seller.platformOverview,
    queryFn: () => sellerStatsService.getPlatformOverview(),
    enabled: headSeller,
  });

  const storeCards: StatCardConfig[] | undefined = overviewQuery.data
    ? [
        { key: 'today-orders', icon: CalendarDays, label: "Today's Orders", value: overviewQuery.data.todayOrders, to: '/seller/orders' },
        { key: 'today-revenue', icon: Wallet, label: "Today's Revenue", value: overviewQuery.data.todayRevenue, to: '/seller/reports', formatter: formatCurrency },
        { key: 'month-revenue', icon: CalendarRange, label: 'Monthly Revenue', value: overviewQuery.data.monthRevenue, to: '/seller/reports', formatter: formatCurrency },
        { key: 'total-revenue', icon: TrendingUp, label: 'Total Revenue', value: overviewQuery.data.totalRevenue, to: '/seller/reports', formatter: formatCurrency },
        { key: 'total-products', icon: Package, label: 'Total Products', value: overviewQuery.data.totalProducts, to: '/seller/products' },
        { key: 'active-products', icon: Package, label: 'Active Products', value: overviewQuery.data.activeProducts, to: '/seller/products' },
        {
          key: 'out-of-stock',
          icon: PackageX,
          label: 'Out of Stock',
          value: overviewQuery.data.outOfStockProducts,
          to: '/seller/inventory',
          tone: overviewQuery.data.outOfStockProducts > 0 ? 'warning' : 'default',
        },
        {
          key: 'low-stock',
          icon: Boxes,
          label: 'Low Stock Items',
          value: overviewQuery.data.lowStockCount,
          to: '/seller/inventory',
          tone: overviewQuery.data.lowStockCount > 0 ? 'warning' : 'default',
        },
        {
          key: 'pending-returns',
          icon: RotateCcw,
          label: 'Pending Returns',
          value: overviewQuery.data.pendingReturns,
          to: '/seller/returns',
          tone: overviewQuery.data.pendingReturns > 0 ? 'warning' : 'default',
        },
        {
          key: 'pending-exchanges',
          icon: Repeat,
          label: 'Exchange Requests',
          value: overviewQuery.data.pendingExchanges,
          to: '/seller/exchanges',
          tone: overviewQuery.data.pendingExchanges > 0 ? 'warning' : 'default',
        },
        {
          key: 'unreplied-reviews',
          icon: MessageSquareWarning,
          label: 'Pending Reviews',
          value: overviewQuery.data.unrepliedReviews,
          to: '/seller/reviews',
          tone: overviewQuery.data.unrepliedReviews > 0 ? 'warning' : 'default',
        },
        {
          key: 'average-rating',
          icon: Star,
          label: 'Average Rating',
          value: overviewQuery.data.averageRating,
          to: '/seller/reviews',
          formatter: (n) => n.toFixed(1),
        },
        { key: 'flash-sale-products', icon: Zap, label: 'Flash Sale Products', value: overviewQuery.data.flashSaleProducts, to: '/seller/products' },
      ]
    : undefined;

  const platformCards: StatCardConfig[] | undefined = platformQuery.data
    ? [
        { key: 'total-sellers', icon: Users, label: 'Registered Sellers', value: platformQuery.data.totalSellers, to: '/seller/sellers' },
        {
          key: 'pending-applications',
          icon: Clock,
          label: 'Pending Seller Approvals',
          value: platformQuery.data.pendingApplications,
          to: '/seller/sellers',
          tone: platformQuery.data.pendingApplications > 0 ? 'warning' : 'default',
        },
        { key: 'platform-orders', icon: ShoppingBag, label: 'Orders (Platform-wide)', value: platformQuery.data.totalOrders, to: '/seller/analytics' },
        { key: 'platform-revenue', icon: Wallet, label: 'Total Revenue', value: platformQuery.data.totalRevenue, to: '/seller/reports', formatter: formatCurrency },
        { key: 'total-customers', icon: Users, label: 'Total Customers', value: platformQuery.data.totalCustomers, to: '/seller/sellers' },
        { key: 'staff-members', icon: UserCog, label: 'Staff Members', value: platformQuery.data.staffMembers, to: '/seller/staff' },
        { key: 'coupons-active', icon: Ticket, label: 'Coupons Active', value: platformQuery.data.couponsActive, to: '/seller/coupons' },
      ]
    : undefined;

  return (
    <div className="space-y-8">
      <Seo title="Seller Dashboard" />
      <DashboardHeader />

      <StatGrid title="Your Store" cards={storeCards} isLoading={overviewQuery.isLoading} isError={overviewQuery.isError} skeletonCount={8} />

      {headSeller && (
        <StatGrid
          title="Platform Overview"
          cards={platformCards}
          isLoading={platformQuery.isLoading}
          isError={platformQuery.isError}
          skeletonCount={7}
        />
      )}

      <QuickActions role={user?.role} />

      <Suspense fallback={<AnalyticsSkeleton />}>
        <SalesAnalyticsSection sellerId={sellerId} isHeadSeller={headSeller} />
      </Suspense>

      <OrdersStatusSummary sellerId={sellerId} isHeadSeller={headSeller} />

      <PaymentsSummary sellerId={sellerId} isHeadSeller={headSeller} />

      <InventorySummary sellerId={sellerId} isHeadSeller={headSeller} />

      {headSeller && <SellerManagementSummary />}

      {headSeller && <StaffManagementSummary sellerId={sellerId} />}

      <RecentActivityFeed />
    </div>
  );
}
