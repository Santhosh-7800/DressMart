import { Clock, CheckCircle, Package, Truck, Navigation, PackageCheck, XCircle, RotateCcw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useOrderStatusBreakdown } from '@/hooks/useDashboardData';
import { STATUS_LABELS } from '@/services/orderService';
import { StatGrid } from './StatGrid';
import type { StatCardConfig, StatTone } from './StatCard';
import type { OrderStatus } from '@/types';

const STATUS_ICONS: Record<OrderStatus, LucideIcon> = {
  placed: Clock,
  confirmed: CheckCircle,
  packed: Package,
  shipped: Truck,
  out_for_delivery: Navigation,
  delivered: PackageCheck,
  cancelled: XCircle,
  returned: RotateCcw,
};

const STATUS_TONES: Record<OrderStatus, StatTone> = {
  placed: 'warning',
  confirmed: 'default',
  packed: 'default',
  shipped: 'default',
  out_for_delivery: 'default',
  delivered: 'success',
  cancelled: 'danger',
  returned: 'danger',
};

const ORDER = ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'] as const;

export function OrdersStatusSummary({ sellerId, isHeadSeller }: { sellerId: string; isHeadSeller: boolean }) {
  const breakdownQuery = useOrderStatusBreakdown(sellerId, isHeadSeller);

  const cards: StatCardConfig[] | undefined = breakdownQuery.data
    ? ORDER.map((status) => ({
        key: status,
        icon: STATUS_ICONS[status],
        label: STATUS_LABELS[status],
        value: breakdownQuery.data[status] ?? 0,
        to: '/seller/orders',
        tone: STATUS_TONES[status],
      }))
    : undefined;

  return (
    <StatGrid
      title="Orders by Status"
      cards={cards}
      isLoading={breakdownQuery.isLoading}
      isError={breakdownQuery.isError}
      skeletonCount={8}
      columnsClassName="md:grid-cols-4"
    />
  );
}
