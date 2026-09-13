import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { UserPlus, Store } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { CHART_ACCENT, CHART_AXIS_COLOR, CHART_GRID_COLOR } from '@/lib/chartPalette';
import { useCustomerGrowth, useSellerGrowth } from '@/hooks/useDashboardData';
import { ChartCard } from './ChartCard';

const GROWTH_DAYS = 30;

function GrowthLine({ data }: { data: { label: string; count: number }[] }) {
  const { theme } = useTheme();
  const axisColor = CHART_AXIS_COLOR[theme];
  const gridColor = CHART_GRID_COLOR[theme];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: axisColor }} axisLine={{ stroke: gridColor }} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} width={30} />
        <Tooltip
          formatter={(value: unknown) => [Number(value) || 0, 'New signups']}
          contentStyle={{ background: theme === 'dark' ? '#1a1d24' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 12, fontSize: 12 }}
        />
        <Line type="monotone" dataKey="count" stroke={CHART_ACCENT} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Head-Seller-only — new buyer/seller signups per day over the last 30 days. */
export function CustomerGrowthChart({ enabled }: { enabled: boolean }) {
  const query = useCustomerGrowth(GROWTH_DAYS, enabled);
  const data = query.data?.map((d) => ({ label: d.date.slice(5), count: d.count }));

  return (
    <ChartCard title="Customer Growth (30 days)" icon={UserPlus} isLoading={query.isLoading} isEmpty={!data}>
      {data && <GrowthLine data={data} />}
    </ChartCard>
  );
}

export function SellerGrowthChart({ enabled }: { enabled: boolean }) {
  const query = useSellerGrowth(GROWTH_DAYS, enabled);
  const data = query.data?.map((d) => ({ label: d.date.slice(5), count: d.count }));

  return (
    <ChartCard title="Seller Growth (30 days)" icon={Store} isLoading={query.isLoading} isEmpty={!data}>
      {data && <GrowthLine data={data} />}
    </ChartCard>
  );
}
