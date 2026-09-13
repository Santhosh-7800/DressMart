import { useMemo } from 'react';
import { Ticket, Percent, ShoppingBag, Wallet, Award, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useSellerOrders } from '@/hooks/useOrders';
import { formatCurrency } from '@/lib/utils';
import type { Coupon } from '@/types';

/**
 * Real, order-derived promotion analytics — no invented metrics. Every number here comes directly
 * from `Order.coupon_code`/`Order.discount`/`Order.total`, which orderPlacement.ts already writes
 * authoritatively for every coupon-discounted order — no new tracking was needed to compute this.
 * "Most-used coupon" is by order count; "best-performing" is by total discount given (the metric
 * most directly tied to what the coupon actually cost, which every coupon type has — unlike
 * conversion-rate-style metrics, which would need view/impression data this app doesn't collect).
 */
export function PromotionAnalytics({ coupons }: { coupons: Coupon[] }) {
  const { data: orders, isLoading } = useSellerOrders();

  const stats = useMemo(() => {
    const couponOrders = (orders ?? []).filter((o) => o.coupon_code && o.status !== 'cancelled');
    const totalDiscountGiven = couponOrders.reduce((sum, o) => sum + o.discount, 0);
    const revenueFromCouponOrders = couponOrders.reduce((sum, o) => sum + o.total, 0);

    const byCoupon = new Map<string, { orders: number; discount: number }>();
    for (const o of couponOrders) {
      const key = o.coupon_code!;
      const entry = byCoupon.get(key) ?? { orders: 0, discount: 0 };
      entry.orders += 1;
      entry.discount += o.discount;
      byCoupon.set(key, entry);
    }
    const mostUsed = [...byCoupon.entries()].sort((a, b) => b[1].orders - a[1].orders)[0];
    const bestPerforming = [...byCoupon.entries()].sort((a, b) => b[1].discount - a[1].discount)[0];

    return {
      couponOrdersCount: couponOrders.length,
      totalDiscountGiven,
      revenueFromCouponOrders,
      mostUsed: mostUsed ? { code: mostUsed[0], orders: mostUsed[1].orders } : null,
      bestPerforming: bestPerforming ? { code: bestPerforming[0], discount: bestPerforming[1].discount } : null,
    };
  }, [orders]);

  const activeCoupons = coupons.filter((c) => c.is_active).length;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Card hover={false} className="p-4">
        <Ticket className="mb-2 text-acc-primary" size={18} />
        <p className="text-2xl font-bold text-acc-text dark:text-white">{activeCoupons}</p>
        <p className="text-xs text-acc-text-secondary">Active Coupons</p>
      </Card>
      <Card hover={false} className="p-4">
        <ShoppingBag className="mb-2 text-acc-primary" size={18} />
        <p className="text-2xl font-bold text-acc-text dark:text-white">{stats.couponOrdersCount}</p>
        <p className="text-xs text-acc-text-secondary">Orders Using Coupons</p>
      </Card>
      <Card hover={false} className="p-4">
        <Percent className="mb-2 text-acc-primary" size={18} />
        <p className="text-2xl font-bold text-acc-text dark:text-white">{formatCurrency(stats.totalDiscountGiven)}</p>
        <p className="text-xs text-acc-text-secondary">Total Discount Given</p>
      </Card>
      <Card hover={false} className="p-4">
        <Wallet className="mb-2 text-acc-primary" size={18} />
        <p className="text-2xl font-bold text-acc-text dark:text-white">{formatCurrency(stats.revenueFromCouponOrders)}</p>
        <p className="text-xs text-acc-text-secondary">Revenue from Coupon Orders</p>
      </Card>
      <Card hover={false} className="p-4">
        <Award className="mb-2 text-acc-primary" size={18} />
        <p className="truncate text-lg font-bold text-acc-text dark:text-white">{stats.mostUsed?.code ?? '—'}</p>
        <p className="text-xs text-acc-text-secondary">{stats.mostUsed ? `Most Used · ${stats.mostUsed.orders} orders` : 'Most Used Coupon'}</p>
      </Card>
      <Card hover={false} className="p-4">
        <TrendingUp className="mb-2 text-acc-primary" size={18} />
        <p className="truncate text-lg font-bold text-acc-text dark:text-white">{stats.bestPerforming?.code ?? '—'}</p>
        <p className="text-xs text-acc-text-secondary">
          {stats.bestPerforming ? `Best Performing · ${formatCurrency(stats.bestPerforming.discount)}` : 'Best Performing'}
        </p>
      </Card>
    </div>
  );
}
