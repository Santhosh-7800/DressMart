import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileBarChart } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAdminOrders, useAdminReturns } from '@/hooks/useAdminOrders';
import { adminDataService } from '@/services/adminDataService';
import { formatCurrency, formatDate } from '@/lib/utils';
import { RETURN_STATUS_LABELS } from '@/lib/returnStatus';

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';
type ReportType = 'sales' | 'products' | 'revenue' | 'refunds' | 'returns' | 'top_customers';

const PERIOD_DAYS: Record<Period, number> = { daily: 1, weekly: 7, monthly: 30, yearly: 365 };
const REPORT_LABELS: Record<ReportType, string> = {
  sales: 'Sales',
  products: 'Products',
  revenue: 'Revenue',
  refunds: 'Refunds',
  returns: 'Returns',
  top_customers: 'Top Customers',
};

function withinPeriod(iso: string, period: Period): boolean {
  const cutoff = Date.now() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000;
  return new Date(iso).getTime() >= cutoff;
}

export function AdminReportsPage() {
  const [period, setPeriod] = useState<Period>('monthly');
  const [reportType, setReportType] = useState<ReportType>('sales');

  const { data: orders, isLoading: isLoadingOrders } = useAdminOrders();
  const { data: returns, isLoading: isLoadingReturns } = useAdminReturns();
  const { data: profiles, isLoading: isLoadingProfiles } = useQuery({ queryKey: ['admin', 'reports', 'profiles'], queryFn: () => adminDataService.getAllProfiles() });

  const isLoading = isLoadingOrders || isLoadingReturns || isLoadingProfiles;

  const scopedOrders = useMemo(() => (orders ?? []).filter((o) => withinPeriod(o.placed_at, period) && o.status !== 'cancelled'), [orders, period]);
  const scopedReturns = useMemo(() => (returns ?? []).filter((r) => withinPeriod(r.created_at, period)), [returns, period]);

  const content = useMemo(() => {
    switch (reportType) {
      case 'sales':
        return { rows: scopedOrders.map((o) => [o.order_number, formatDate(o.placed_at), o.status, formatCurrency(o.total)]), headers: ['Order #', 'Date', 'Status', 'Total'] };
      case 'revenue': {
        const total = scopedOrders.reduce((sum, o) => sum + o.total, 0);
        return {
          rows: [
            ['Total Revenue', formatCurrency(total)],
            ['Orders', String(scopedOrders.length)],
            ['Average Order Value', formatCurrency(scopedOrders.length ? total / scopedOrders.length : 0)],
          ],
          headers: ['Metric', 'Value'],
        };
      }
      case 'products': {
        const qtyByProduct = new Map<string, { name: string; qty: number; revenue: number }>();
        scopedOrders.forEach((o) =>
          o.items.forEach((item) => {
            const existing = qtyByProduct.get(item.product_id);
            qtyByProduct.set(item.product_id, {
              name: item.product_name,
              qty: (existing?.qty ?? 0) + item.quantity,
              revenue: (existing?.revenue ?? 0) + item.total_price,
            });
          }),
        );
        const sorted = [...qtyByProduct.values()].sort((a, b) => b.qty - a.qty);
        return { rows: sorted.map((p) => [p.name, String(p.qty), formatCurrency(p.revenue)]), headers: ['Product', 'Units Sold', 'Revenue'] };
      }
      case 'refunds': {
        const refunded = scopedReturns.filter((r) => r.status === 'refunded');
        return { rows: refunded.map((r) => [formatDate(r.created_at), r.reason, formatCurrency(r.refund_amount)]), headers: ['Date', 'Reason', 'Refund Amount'] };
      }
      case 'returns':
        return { rows: scopedReturns.map((r) => [formatDate(r.created_at), r.reason, RETURN_STATUS_LABELS[r.status], formatCurrency(r.refund_amount)]), headers: ['Date', 'Reason', 'Status', 'Amount'] };
      case 'top_customers': {
        const revenueByCustomer = new Map<string, number>();
        scopedOrders.forEach((o) => revenueByCustomer.set(o.user_id, (revenueByCustomer.get(o.user_id) ?? 0) + o.total));
        const sorted = [...revenueByCustomer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
        return {
          rows: sorted.map(([userId, revenue]) => [(profiles ?? []).find((p) => p.id === userId)?.full_name ?? userId, formatCurrency(revenue)]),
          headers: ['Customer', 'Total Spend'],
        };
      }
    }
  }, [reportType, scopedOrders, scopedReturns, profiles]);

  return (
    <div>
      <Seo title="Admin — Reports" />
      <div className="mb-5 flex items-center gap-2">
        <FileBarChart size={22} className="text-accent" />
        <h1 className="text-2xl font-bold">Reports</h1>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <select className="input-field w-auto text-sm" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
        <select className="input-field w-auto text-sm" value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)}>
          {Object.entries(REPORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="admin-table-wrap scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="border-b border-primary-100 text-left text-xs uppercase tracking-wide text-primary-400 dark:border-primary-700">
                {content?.headers.map((h) => (
                  <th key={h} className="p-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content?.rows.map((row, i) => (
                <tr key={i} className="border-b border-primary-100 last:border-0 dark:border-primary-700">
                  {row.map((cell, j) => (
                    <td key={j} className="p-3">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
              {(content?.rows.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={content?.headers.length ?? 1} className="p-8 text-center text-primary-400">
                    No data for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
