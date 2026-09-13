import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { LucideIcon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { CHART_AXIS_COLOR, CHART_GRID_COLOR, categoricalColor } from '@/lib/chartPalette';
import { ChartCard } from './ChartCard';

interface RankedBarChartProps {
  title: string;
  icon: LucideIcon;
  isLoading: boolean;
  data: { name: string; value: number }[] | undefined;
  valueFormatter?: (n: number) => string;
  emptyLabel?: string;
}

/** Horizontal ranked bar chart — Top Categories, Revenue by Category, Top Brands, Best Sellers all
 *  share this exact shape (a name + a single ranked metric), just with different data sources. */
export function RankedBarChart({ title, icon, isLoading, data, valueFormatter = (n) => String(n), emptyLabel }: RankedBarChartProps) {
  const { theme } = useTheme();
  const axisColor = CHART_AXIS_COLOR[theme];
  const gridColor = CHART_GRID_COLOR[theme];
  const isEmpty = !data || data.length === 0;

  return (
    <ChartCard title={title} icon={icon} isLoading={isLoading} isEmpty={isEmpty} emptyLabel={emptyLabel}>
      {data && (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} tickFormatter={valueFormatter} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} width={90} />
            <Tooltip
              formatter={(value: unknown) => [valueFormatter(Number(value) || 0), title]}
              contentStyle={{ background: theme === 'dark' ? '#1a1d24' : '#fff', border: `1px solid ${gridColor}`, borderRadius: 12, fontSize: 12 }}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {data.map((entry, i) => (
                <Cell key={entry.name} fill={categoricalColor(i)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
