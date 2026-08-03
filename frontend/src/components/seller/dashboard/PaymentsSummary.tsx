import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CalendarClock, CalendarRange, Wallet, Percent, HandCoins, Clock, CheckCircle2 } from 'lucide-react';
import { sellerStatsService } from '@/services/sellerStatsService';
import { queryKeys } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/utils';
import { useWeeklyRevenue, usePlatformSettings, usePayouts } from '@/hooks/useDashboardData';
import { StatGrid } from './StatGrid';
import type { StatCardConfig } from './StatCard';

interface PaymentsSummaryProps {
  sellerId: string;
  isHeadSeller: boolean;
}

/** Today/Weekly/Monthly revenue, the commission split (derived from PlatformSettings.commission_rate_percent
 *  — see the redesign plan's schema-gap decision #2), and payout status counts (see payoutService). */
export function PaymentsSummary({ sellerId, isHeadSeller }: PaymentsSummaryProps) {
  const overviewQuery = useQuery({
    queryKey: queryKeys.seller.overview(sellerId),
    queryFn: () => sellerStatsService.getSellerOverview(sellerId),
    enabled: Boolean(sellerId),
  });
  const platformQuery = useQuery({
    queryKey: queryKeys.seller.platformOverview,
    queryFn: () => sellerStatsService.getPlatformOverview(),
    enabled: isHeadSeller,
  });
  const weeklyRevenue = useWeeklyRevenue(sellerId, isHeadSeller);
  const settingsQuery = usePlatformSettings();
  const payoutsQuery = usePayouts(sellerId, isHeadSeller);

  const todayRevenue = isHeadSeller ? platformQuery.data?.todayRevenue : overviewQuery.data?.todayRevenue;
  const monthRevenue = isHeadSeller ? platformQuery.data?.monthRevenue : overviewQuery.data?.monthRevenue;
  const revenueLoading = isHeadSeller ? platformQuery.isLoading : overviewQuery.isLoading;

  const commissionRate = settingsQuery.data?.commission_rate_percent ?? 0;
  const platformEarnings = monthRevenue != null ? (monthRevenue * commissionRate) / 100 : undefined;
  const sellerEarnings = monthRevenue != null && platformEarnings != null ? monthRevenue - platformEarnings : undefined;

  const revenueCards: StatCardConfig[] | undefined =
    todayRevenue != null && weeklyRevenue.data != null && monthRevenue != null
      ? [
          { key: 'today-revenue', icon: CalendarDays, label: "Today's Revenue", value: todayRevenue, formatter: formatCurrency },
          { key: 'weekly-revenue', icon: CalendarClock, label: 'Weekly Revenue', value: weeklyRevenue.data, formatter: formatCurrency },
          { key: 'monthly-revenue', icon: CalendarRange, label: 'Monthly Revenue', value: monthRevenue, formatter: formatCurrency },
        ]
      : undefined;

  const commissionCards: StatCardConfig[] | undefined =
    platformEarnings != null && sellerEarnings != null
      ? [
          { key: 'commission-rate', icon: Percent, label: 'Commission Rate', value: commissionRate, formatter: (n) => `${n.toFixed(1)}%` },
          { key: 'platform-earnings', icon: Wallet, label: 'Platform Earnings (month)', value: platformEarnings, formatter: formatCurrency },
          { key: 'seller-earnings', icon: HandCoins, label: 'Seller Earnings (month)', value: sellerEarnings, formatter: formatCurrency },
        ]
      : undefined;

  const payoutCards: StatCardConfig[] | undefined = payoutsQuery.data
    ? [
        {
          key: 'pending-payouts',
          icon: Clock,
          label: 'Pending Payouts',
          value: payoutsQuery.data.filter((p) => p.status === 'pending').length,
          to: isHeadSeller ? '/seller/reports' : undefined,
          tone: payoutsQuery.data.some((p) => p.status === 'pending') ? 'warning' : 'default',
        },
        {
          key: 'completed-payouts',
          icon: CheckCircle2,
          label: 'Completed Payouts',
          value: payoutsQuery.data.filter((p) => p.status === 'paid').length,
          to: isHeadSeller ? '/seller/reports' : undefined,
          tone: 'success',
        },
      ]
    : undefined;

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-acc-text-secondary">Payments</h2>
      <StatGrid title="Revenue" cards={revenueCards} isLoading={revenueLoading || weeklyRevenue.isLoading} skeletonCount={3} columnsClassName="md:grid-cols-3" />
      <StatGrid title="Commission Split" cards={commissionCards} isLoading={settingsQuery.isLoading || revenueLoading} skeletonCount={3} columnsClassName="md:grid-cols-3" />
      <StatGrid title="Payouts" cards={payoutCards} isLoading={payoutsQuery.isLoading} skeletonCount={2} columnsClassName="md:grid-cols-2" />
    </section>
  );
}
