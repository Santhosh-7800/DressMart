import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { ORDER_STATUS_COLORS } from '@/lib/chartPalette';
import { STATUS_LABELS } from '@/services/orderService';
import { useOrderStatusBreakdown } from '@/hooks/useDashboardData';
import { ChartCard } from './ChartCard';
import type { OrderStatus } from '@/types';

export function OrderStatusPie({ sellerId, isHeadSeller }: { sellerId: string; isHeadSeller: boolean }) {
  const { theme } = useTheme();
  const query = useOrderStatusBreakdown(sellerId, isHeadSeller);

  const data = query.data
    ? (Object.entries(query.data) as [OrderStatus, number][]).filter(([, count]) => count > 0).map(([status, count]) => ({ name: STATUS_LABELS[status], value: count, status }))
    : undefined;
  const isEmpty = !data || data.length === 0;

  return (
    <ChartCard title="Order Status Breakdown" icon={PieChartIcon} isLoading={query.isLoading} isEmpty={isEmpty} emptyLabel="No orders yet.">
      {data && (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
              {data.map((entry) => (
                <Cell key={entry.status} fill={ORDER_STATUS_COLORS[entry.status]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: theme === 'dark' ? '#1a1d24' : '#fff', borderRadius: 12, fontSize: 12, border: 'none' }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
