import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sellerStatsService } from '@/services/sellerStatsService';
import { orderService } from '@/services/orderService';
import { returnService } from '@/services/returnService';
import { exchangeService } from '@/services/exchangeService';
import { reviewService } from '@/services/reviewService';
import { sellerAdminService } from '@/services/sellerAdminService';
import { staffAdminService } from '@/services/staffAdminService';
import { payoutService } from '@/services/payoutService';
import { platformSettingsService } from '@/services/platformSettingsService';
import { queryKeys } from '@/lib/queryClient';
import type { Order, Review, ReturnRequest, ExchangeRequest } from '@/types';

export function useOrderStatusBreakdown(sellerId: string, isHeadSeller: boolean) {
  return useQuery({
    queryKey: queryKeys.seller.orderStatusBreakdown(sellerId),
    queryFn: () => sellerStatsService.getOrderStatusBreakdown(sellerId, isHeadSeller),
    enabled: Boolean(sellerId),
  });
}

export function useLowStockList(sellerId: string) {
  return useQuery({
    queryKey: queryKeys.seller.lowStockList(sellerId),
    queryFn: () => sellerStatsService.listLowStock(sellerId),
    enabled: Boolean(sellerId),
  });
}

export function useOutOfStockList(sellerId: string) {
  return useQuery({
    queryKey: queryKeys.seller.outOfStockList(sellerId),
    queryFn: () => sellerStatsService.listOutOfStock(sellerId),
    enabled: Boolean(sellerId),
  });
}

export function useRecentlyAddedProducts(sellerId: string) {
  return useQuery({
    queryKey: queryKeys.seller.recentlyAdded(sellerId),
    queryFn: () => sellerStatsService.listRecentlyAdded(sellerId),
    enabled: Boolean(sellerId),
  });
}

export function useDealsEndingSoon(sellerId: string) {
  return useQuery({
    queryKey: queryKeys.seller.dealsEndingSoon(sellerId),
    queryFn: () => sellerStatsService.listDealsEndingSoon(sellerId),
    enabled: Boolean(sellerId),
  });
}

export function useTopSellingProducts(sellerId: string, isHeadSeller: boolean) {
  return useQuery({
    queryKey: queryKeys.seller.topSelling(sellerId),
    queryFn: () => sellerStatsService.listTopSelling(sellerId, isHeadSeller),
    enabled: Boolean(sellerId),
  });
}

/** Realtime, bounded (5 most recent orders) — powers the dashboard's live "Recent Orders" feed. */
export function useRecentOrdersLive(sellerId: string, isHeadSeller: boolean) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!sellerId) return;
    setIsLoading(true);
    const unsubscribe = orderService.subscribeRecentForSeller(sellerId, isHeadSeller, 5, (rows) => {
      setOrders(rows);
      setIsLoading(false);
    });
    return unsubscribe;
  }, [sellerId, isHeadSeller]);

  return { orders, isLoading };
}

export function useRecentReturns(sellerId: string, isHeadSeller: boolean) {
  return useQuery({
    queryKey: queryKeys.returns.bySeller(sellerId),
    queryFn: (): Promise<ReturnRequest[]> => returnService.listForSeller(sellerId, isHeadSeller),
    enabled: Boolean(sellerId),
    select: (rows) => rows.slice(0, 5),
  });
}

export function useRecentExchanges(sellerId: string, isHeadSeller: boolean) {
  return useQuery({
    queryKey: queryKeys.exchanges.bySeller(sellerId),
    queryFn: (): Promise<ExchangeRequest[]> => exchangeService.listForSeller(sellerId, isHeadSeller),
    enabled: Boolean(sellerId),
    select: (rows) => rows.slice(0, 5),
  });
}

export function useRecentReviews(sellerId: string) {
  return useQuery({
    queryKey: [...queryKeys.reviews.byProduct('seller-dashboard'), sellerId],
    queryFn: (): Promise<(Review & { product_name: string; product_slug: string })[]> => reviewService.listForSeller(sellerId),
    enabled: Boolean(sellerId),
    select: (rows) => rows.slice(0, 5),
  });
}

export function useLatestSellerRegistrations(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.sellerRequests.all,
    queryFn: () => sellerAdminService.listSellerRequests(),
    enabled,
    select: (rows) => rows.slice(0, 5),
  });
}

export function useLatestStaffActivity(sellerId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.staff.activity(sellerId),
    queryFn: () => staffAdminService.listStaffActivity(sellerId, 5),
    enabled: enabled && Boolean(sellerId),
  });
}

/** Powers both the 7-day and 30-day sales charts, and (fetched separately at 180 days) the
 *  6-month revenue trend — a single date-bounded fetch per range, bucketed client-side. */
export function useOrdersInRange(sellerId: string, isHeadSeller: boolean, days: number) {
  return useQuery({
    queryKey: queryKeys.seller.ordersInRange(sellerId, days),
    queryFn: () => sellerStatsService.getOrdersInRange(sellerId, isHeadSeller, days),
    enabled: Boolean(sellerId),
  });
}

export function useCategoryBreakdown(sellerId: string, isHeadSeller: boolean) {
  return useQuery({
    queryKey: queryKeys.seller.categoryBreakdown(sellerId),
    queryFn: () => sellerStatsService.getCategoryBreakdown(sellerId, isHeadSeller),
    enabled: Boolean(sellerId),
  });
}

export function useCustomerGrowth(days: number, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.seller.userGrowth('buyer', days),
    queryFn: () => sellerStatsService.getUserGrowth(days, ['buyer']),
    enabled,
  });
}

export function useSellerGrowth(days: number, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.seller.userGrowth('seller', days),
    queryFn: () => sellerStatsService.getUserGrowth(days, ['seller', 'head_seller']),
    enabled,
  });
}

/** This week's revenue, derived from the same 30-day order window the Analytics section already
 *  fetches (react-query dedupes the identical query key) rather than a fresh fetch. */
export function useWeeklyRevenue(sellerId: string, isHeadSeller: boolean) {
  const query = useOrdersInRange(sellerId, isHeadSeller, 30);
  const weeklyRevenue = query.data
    ? (() => {
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return query.data
          .filter((o) => o.payment_status === 'paid' && new Date(o.placed_at).getTime() >= cutoff)
          .reduce((sum, o) => sum + o.total, 0);
      })()
    : undefined;
  return { data: weeklyRevenue, isLoading: query.isLoading, isError: query.isError };
}

export function usePlatformSettings() {
  return useQuery({ queryKey: queryKeys.seller.platformSettings, queryFn: () => platformSettingsService.get() });
}

export function usePayouts(sellerId: string, isHeadSeller: boolean) {
  return useQuery({
    queryKey: queryKeys.seller.payouts(sellerId, isHeadSeller),
    queryFn: () => (isHeadSeller ? payoutService.listAll() : payoutService.listForSeller(sellerId)),
    enabled: Boolean(sellerId),
  });
}
