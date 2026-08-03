import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarDays, CalendarRange, BarChart3 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCurrency } from '@/lib/utils';
import { CHART_ACCENT, CHART_AXIS_COLOR, CHART_GRID_COLOR } from '@/lib/chartPalette';
import { ChartCard } from './ChartCard';
import { useOrdersInRange } from '@/hooks/useDashboardData';
import { groupOrdersByDay, groupOrdersByMonth } from '@/services/sellerStatsService';

/** Revenue-only trend — deliberately a single metric/single axis (never a dual-axis chart mixing
 *  revenue and order count on different scales). */
function TrendChart({ data }: { data: { label: string; revenue: number }[] }) {
  const { theme } = useTheme();
  const axisColor = CHART_AXIS_COLOR[theme];
  const gridColor = CHART_GRID_COLOR[theme];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="salesTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_ACCENT} stopOpacity={0.35} />
            <stop offset="95%" stopColor={CHART_ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: axisColor }} axisLine={{ stroke: gridColor }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v).replace('.00', '')} width={70} />
        <Tooltip
          formatter={(value: unknown) => [formatCurrency(Number(value) || 0), 'Revenue']}
          contentStyle={{ background: theme === 'dark' ? '#1a1d24' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 12, fontSize: 12 }}
        />
        <Area type="monotone" dataKey="revenue" stroke={CHART_ACCENT} strokeWidth={2} fill="url(#salesTrendFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SalesLast7DaysChart({ sellerId, isHeadSeller }: { sellerId: string; isHeadSeller: boolean }) {
  const query = useOrdersInRange(sellerId, isHeadSeller, 30);
  const data = query.data ? groupOrdersByDay(query.data, 7).map((d) => ({ label: d.date.slice(5), revenue: d.revenue })) : undefined;

  return (
    <ChartCard title="Sales — Last 7 Days" icon={CalendarDays} isLoading={query.isLoading} isEmpty={!data}>
      {data && <TrendChart data={data} />}
    </ChartCard>
  );
}

export function SalesLast30DaysChart({ sellerId, isHeadSeller }: { sellerId: string; isHeadSeller: boolean }) {
  const query = useOrdersInRange(sellerId, isHeadSeller, 30);
  const data = query.data ? groupOrdersByDay(query.data, 30).map((d) => ({ label: d.date.slice(5), revenue: d.revenue })) : undefined;

  return (
    <ChartCard title="Sales — Last 30 Days" icon={CalendarRange} isLoading={query.isLoading} isEmpty={!data}>
      {data && <TrendChart data={data} />}
    </ChartCard>
  );
}

export function MonthlyRevenueChart({ sellerId, isHeadSeller }: { sellerId: string; isHeadSeller: boolean }) {
  const query = useOrdersInRange(sellerId, isHeadSeller, 182);
  const data = query.data ? groupOrdersByMonth(query.data, 6).map((d) => ({ label: d.month, revenue: d.revenue })) : undefined;

  return (
    <ChartCard title="Monthly Revenue" icon={BarChart3} isLoading={query.isLoading} isEmpty={!data}>
      {data && <TrendChart data={data} />}
    </ChartCard>
  );
}
