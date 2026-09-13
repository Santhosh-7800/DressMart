import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  BarChart3,
  IndianRupee,
  ShoppingBag,
  Package,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  UserPlus,
  UserCheck,
  RotateCcw,
  Repeat,
  XCircle,
  Banknote,
  CreditCard,
  Truck,
  AlertTriangle,
  FileText,
  FileSpreadsheet,
  FileDown,
  ArrowUpDown,
} from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { RankedBarChart } from '@/components/admin/dashboard/charts/RankedBarChart';
import { useAuth } from '@/contexts/AuthContext';
import { useSellerReturns } from '@/hooks/useReturns';
import { useSellerExchanges } from '@/hooks/useExchanges';
import { isAdminRole as checkIsHeadSeller, effectiveSellerId } from '@/lib/roles';
import { formatCurrency, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  resolveRangePreset,
  getOrdersForDateRange,
  fetchProductsAndStock,
  classifyNewVsReturning,
  summarizeSales,
  summarizeCancellations,
  summarizeByGender,
  summarizeByColorAndSize,
  buildProductPerformance,
  sortProductPerformance,
  findLowPerformingProducts,
  summarizeReturns,
  summarizeExchanges,
  summarizePayments,
  summarizeDelivery,
  comparePeriods,
  generateBusinessSummary,
  RANGE_PRESET_LABELS,
  type RangePreset,
  type ProductSortKey,
} from '@/services/businessReportService';
import type { ReportExportInput } from '@/lib/reportExport';

const ALL_PRESETS: RangePreset[] = ['today', 'yesterday', 'last7', 'last30', 'thisMonth', 'prevMonth', 'thisYear', 'custom'];

function isoDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function ChangeBadge({ percentChange }: { percentChange: number | null }) {
  if (percentChange === null) return <span className="text-xs font-medium text-acc-text-secondary">New activity</span>;
  const isUp = percentChange > 0;
  const isFlat = percentChange === 0;
  const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;
  return (
    <span className={cn('flex items-center gap-1 text-xs font-semibold', isFlat ? 'text-acc-text-secondary' : isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
      <Icon size={12} /> {Math.abs(percentChange).toFixed(1)}%
    </span>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  change,
  tone,
}: {
  icon: typeof IndianRupee;
  label: string;
  value: string;
  change?: number | null;
  tone?: 'danger';
}) {
  return (
    <Card hover={false} className="p-3">
      <div className={cn('mb-1 flex items-center gap-1.5 text-xs', tone === 'danger' ? 'text-red-500' : 'text-acc-text-secondary')}>
        <Icon size={13} /> {label}
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-lg font-bold text-acc-text dark:text-white">{value}</p>
        {change !== undefined && <ChangeBadge percentChange={change} />}
      </div>
    </Card>
  );
}

/**
 * Phase 18 — the genuinely new analytics gaps found during the audit (men's-vs-kids' comparison,
 * period-over-period % change, new-vs-returning customers, color/size performance, a full date-range
 * preset set with explicit Asia/Kolkata boundaries). Deliberately does NOT duplicate what already
 * exists on SellerDashboardPage/SellerAnalyticsPage/SellerReportsPage (KPI cards, sales trend charts,
 * category-by-units, top products/brands, revenue-by-seller export) — those stay as-is.
 */
export function AdminBusinessReportsPage() {
  const { user } = useAuth();
  const headSeller = checkIsHeadSeller(user?.role);
  const sellerId = effectiveSellerId(user);

  const [preset, setPreset] = useState<RangePreset>('last7');
  const [customStart, setCustomStart] = useState(isoDateInput(new Date(Date.now() - 6 * 86400000)));
  const [customEnd, setCustomEnd] = useState(isoDateInput(new Date()));
  const [productSort, setProductSort] = useState<ProductSortKey>('revenue');
  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'excel' | 'csv' | null>(null);

  const resolved = useMemo(() => {
    try {
      return resolveRangePreset(preset, preset === 'custom' ? new Date(`${customStart}T00:00:00`) : undefined, preset === 'custom' ? new Date(`${customEnd}T00:00:00`) : undefined);
    } catch {
      return resolveRangePreset('last7');
    }
  }, [preset, customStart, customEnd]);

  const currentOrdersQuery = useQuery({
    queryKey: ['business-report', 'orders', sellerId, headSeller, resolved.current.start.toISOString(), resolved.current.end.toISOString()],
    queryFn: () => getOrdersForDateRange(sellerId, headSeller, resolved.current),
  });
  const previousOrdersQuery = useQuery({
    queryKey: ['business-report', 'orders', sellerId, headSeller, resolved.previous.start.toISOString(), resolved.previous.end.toISOString()],
    queryFn: () => getOrdersForDateRange(sellerId, headSeller, resolved.previous),
  });
  const productsQuery = useQuery({
    queryKey: ['business-report', 'products', sellerId, headSeller],
    queryFn: () => fetchProductsAndStock(sellerId, headSeller),
    staleTime: 5 * 60 * 1000,
  });
  const { data: allReturns } = useSellerReturns();
  const { data: allExchanges } = useSellerExchanges();

  // Memoized (not just `?? []`) so every consumer below gets a STABLE empty-array reference while
  // loading — a fresh `[]` literal on every render would otherwise re-trigger every useMemo/useQuery
  // that depends on `currentOrders`/`previousOrders` on every single render, not just when the real
  // data changes.
  const currentOrders = useMemo(() => currentOrdersQuery.data?.orders ?? [], [currentOrdersQuery.data]);
  const previousOrders = useMemo(() => previousOrdersQuery.data?.orders ?? [], [previousOrdersQuery.data]);

  const customerSegmentQuery = useQuery({
    queryKey: ['business-report', 'customer-segment', sellerId, headSeller, resolved.current.start.toISOString(), currentOrders.length],
    queryFn: () => classifyNewVsReturning(sellerId, headSeller, currentOrders, resolved.current.start),
    enabled: currentOrdersQuery.isSuccess,
  });

  const isLoading = currentOrdersQuery.isLoading || previousOrdersQuery.isLoading || productsQuery.isLoading;
  const isError = currentOrdersQuery.isError || previousOrdersQuery.isError || productsQuery.isError;

  const productsById = useMemo(() => new Map((productsQuery.data?.products ?? []).map((p) => [p.id, p])), [productsQuery.data]);
  const stockByProductId = useMemo(() => productsQuery.data?.stockByProductId ?? new Map<string, number>(), [productsQuery.data]);

  const currentSales = useMemo(() => summarizeSales(currentOrders), [currentOrders]);
  const previousSales = useMemo(() => summarizeSales(previousOrders), [previousOrders]);
  const comparison = useMemo(() => comparePeriods(currentSales, previousSales), [currentSales, previousSales]);
  const summaryLines = useMemo(() => generateBusinessSummary(comparison, previousSales.orderCount), [comparison, previousSales.orderCount]);

  const cancellations = useMemo(() => summarizeCancellations(currentOrders), [currentOrders]);
  const genderSummary = useMemo(() => summarizeByGender(currentOrders, productsById), [currentOrders, productsById]);
  const variantPerformance = useMemo(() => summarizeByColorAndSize(currentOrders), [currentOrders]);
  const productRows = useMemo(() => buildProductPerformance(currentOrders, productsById, stockByProductId), [currentOrders, productsById, stockByProductId]);
  const sortedProducts = useMemo(() => sortProductPerformance(productRows, productSort).slice(0, 15), [productRows, productSort]);
  const lowPerformers = useMemo(() => {
    const activeInStock = (productsQuery.data?.products ?? []).filter((p) => p.status === 'active' && (stockByProductId.get(p.id) ?? 0) > 0);
    return findLowPerformingProducts(productRows, activeInStock, stockByProductId, 10);
  }, [productRows, productsQuery.data, stockByProductId]);

  const returnsInRange = useMemo(
    () => (allReturns ?? []).filter((r) => new Date(r.created_at) >= resolved.current.start && new Date(r.created_at) <= resolved.current.end),
    [allReturns, resolved],
  );
  const exchangesInRange = useMemo(
    () => (allExchanges ?? []).filter((e) => new Date(e.created_at) >= resolved.current.start && new Date(e.created_at) <= resolved.current.end),
    [allExchanges, resolved],
  );
  const returnsSummary = useMemo(() => summarizeReturns(returnsInRange), [returnsInRange]);
  const exchangesSummary = useMemo(() => summarizeExchanges(exchangesInRange), [exchangesInRange]);
  const payments = useMemo(() => summarizePayments(currentOrders), [currentOrders]);
  const delivery = useMemo(() => summarizeDelivery(currentOrders), [currentOrders]);

  const menRow = genderSummary.find((g) => g.gender === 'men');
  const kidsRow = genderSummary.find((g) => g.gender === 'kids');

  const handleExport = async (format: 'pdf' | 'excel' | 'csv') => {
    setExportingFormat(format);
    try {
      const { exportReportToCsv, exportReportToExcel, exportReportToPdf } = await import('@/lib/reportExport');
      const input = buildExportInput();
      if (format === 'pdf') exportReportToPdf(input);
      else if (format === 'excel') exportReportToExcel(input);
      else exportReportToCsv(input);
    } catch {
      toast.error('Could not generate the report file.');
    } finally {
      setExportingFormat(null);
    }
  };

  const buildExportInput = (): ReportExportInput => ({
    filenamePrefix: 'dressmart-business-report',
    reportTitle: `DressMart Business Report — ${resolved.label}`,
    summary: [
      { label: 'Period', value: `${formatDate(resolved.current.start.toISOString())} to ${formatDate(resolved.current.end.toISOString())}` },
      { label: 'Total Sales', value: formatCurrency(currentSales.netSales) },
      { label: 'Orders', value: String(currentSales.successfulOrderCount) },
      { label: 'Average Order Value', value: formatCurrency(currentSales.averageOrderValue) },
      { label: 'Units Sold', value: String(currentSales.unitsSold) },
      { label: 'Returns Completed', value: `${returnsSummary.completedCount} (${formatCurrency(returnsSummary.completedValue)})` },
      { label: 'Exchanges Completed', value: String(exchangesSummary.completedCount) },
      { label: 'Cancellations', value: `${cancellations.count} (${formatCurrency(cancellations.value)})` },
      { label: 'COD Revenue', value: formatCurrency(payments.cod.revenue) },
      { label: 'Online Revenue', value: formatCurrency(payments.online.revenue) },
      { label: 'Delivered', value: String(delivery.deliveredCount) },
      { label: 'Failed Deliveries', value: String(delivery.failedCount) },
    ],
    tables: [
      {
        title: 'Category Performance',
        headers: ['Category', 'Units Sold', 'Revenue'],
        rows: (() => {
          const byCategory = new Map<string, { units: number; revenue: number }>();
          productRows.forEach((r) => {
            const row = byCategory.get(r.category_name) ?? { units: 0, revenue: 0 };
            row.units += r.unitsSold;
            row.revenue += r.revenue;
            byCategory.set(r.category_name, row);
          });
          return Array.from(byCategory.entries())
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .map(([name, v]) => [name, v.units, formatCurrency(v.revenue)]);
        })(),
      },
      {
        title: 'Top Products',
        headers: ['Product', 'SKU', 'Category', 'Units Sold', 'Revenue', 'Current Stock'],
        rows: sortedProducts.map((p) => [p.product_name, p.sku ?? '—', p.category_name, p.unitsSold, formatCurrency(p.revenue), p.currentStock ?? '—']),
      },
    ],
  });

  return (
    <div className="space-y-6">
      <Seo title="Business Reports" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-acc-text dark:text-white">Business Reports</h1>
          <p className="mt-1 text-sm text-acc-text-secondary">Advanced analytics for the selected period, computed from real order/product/inventory data.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={currentOrders.length === 0} isLoading={exportingFormat === 'pdf'} onClick={() => void handleExport('pdf')}>
            <FileText size={14} /> PDF
          </Button>
          <Button variant="outline" size="sm" disabled={currentOrders.length === 0} isLoading={exportingFormat === 'excel'} onClick={() => void handleExport('excel')}>
            <FileSpreadsheet size={14} /> Excel
          </Button>
          <Button variant="outline" size="sm" disabled={currentOrders.length === 0} isLoading={exportingFormat === 'csv'} onClick={() => void handleExport('csv')}>
            <FileDown size={14} /> CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {ALL_PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium',
              preset === p ? 'bg-accent text-primary-900' : 'bg-primary-100 text-primary-500 dark:bg-primary-800 dark:text-primary-300',
            )}
          >
            {RANGE_PRESET_LABELS[p]}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <Card hover={false} className="flex flex-wrap items-end gap-4 p-4">
          <Input floating label="From" type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="max-w-[180px]" />
          <Input floating label="To" type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="max-w-[180px]" />
        </Card>
      )}
      <p className="text-xs text-acc-text-secondary">
        Showing {formatDate(resolved.current.start.toISOString())} – {formatDate(resolved.current.end.toISOString())}
        {resolved.isPartial ? ' (in progress)' : ''}, compared with {formatDate(resolved.previous.start.toISOString())} – {formatDate(resolved.previous.end.toISOString())}.
        {currentOrdersQuery.data?.capped && ` Showing the first ${currentOrders.length} orders in this range — narrow the date range for full precision.`}
      </p>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : isError ? (
        <Card hover={false} className="flex flex-col items-center gap-3 py-8 text-center">
          <AlertTriangle className="text-red-500" size={24} />
          <p className="text-sm text-acc-text-secondary">Unable to load analytics.</p>
          <button
            onClick={() => {
              void currentOrdersQuery.refetch();
              void previousOrdersQuery.refetch();
              void productsQuery.refetch();
            }}
            className="text-sm font-semibold text-accent"
          >
            Retry
          </button>
        </Card>
      ) : currentOrders.length === 0 ? (
        <EmptyState icon={BarChart3} title="No sales data for this period" description="Try a different date range." />
      ) : (
        <>
          <Card hover={false} className="p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-acc-text dark:text-white">
              <TrendingUp size={15} className="text-acc-primary" /> Business Summary
            </h2>
            <ul className="space-y-1 text-sm text-acc-text-secondary">
              {summaryLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard icon={IndianRupee} label="Gross Sales" value={formatCurrency(currentSales.grossSales)} />
            <KpiCard icon={IndianRupee} label="Discounts" value={formatCurrency(currentSales.discounts)} />
            <KpiCard icon={IndianRupee} label="Net Sales" value={formatCurrency(currentSales.netSales)} change={comparison.sales.percentChange} />
            <KpiCard icon={ShoppingBag} label="Orders" value={String(currentSales.successfulOrderCount)} change={comparison.orders.percentChange} />
            <KpiCard icon={IndianRupee} label="Avg Order Value" value={formatCurrency(currentSales.averageOrderValue)} change={comparison.aov.percentChange} />
            <KpiCard icon={Package} label="Units Sold" value={String(currentSales.unitsSold)} change={comparison.units.percentChange} />
            <KpiCard icon={XCircle} label="Cancelled" value={`${cancellations.count} · ${formatCurrency(cancellations.value)}`} tone="danger" />
            <KpiCard icon={BarChart3} label="Cancellation Rate" value={`${cancellations.percentOfOrders.toFixed(1)}%`} />
          </div>

          <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-acc-text-secondary">Men's vs Kids' Performance</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(['men', 'kids'] as const).map((g) => {
                const row = g === 'men' ? menRow : kidsRow;
                return (
                  <Card key={g} hover={false} className="p-4">
                    <p className="text-sm font-bold capitalize text-acc-text dark:text-white">{g}'s Wear</p>
                    <p className="mt-1 text-2xl font-bold text-acc-primary">{formatCurrency(row?.sales ?? 0)}</p>
                    <p className="text-xs text-acc-text-secondary">{row?.unitsSold ?? 0} units sold</p>
                    {row && row.topProducts.length > 0 && (
                      <div className="mt-3 space-y-1 border-t border-acc-border pt-2 dark:border-primary-700">
                        <p className="text-xs font-semibold text-acc-text-secondary">Top Products</p>
                        {row.topProducts.slice(0, 3).map((p) => (
                          <p key={p.product_id} className="truncate text-xs text-acc-text-secondary">
                            {p.product_name} · {formatCurrency(p.revenue)}
                          </p>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <RankedBarChart
              title="Top Colors (Units Sold)"
              icon={Package}
              isLoading={false}
              data={variantPerformance.colors.slice(0, 8).map((c) => ({ name: c.value, value: c.unitsSold }))}
              emptyLabel="No sales yet to break down by color."
            />
            <RankedBarChart
              title="Top Sizes (Units Sold)"
              icon={Package}
              isLoading={false}
              data={variantPerformance.sizes.slice(0, 8).map((s) => ({ name: s.value, value: s.unitsSold }))}
              emptyLabel="No sales yet to break down by size."
            />
          </div>

          <Card hover={false}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-bold text-acc-text dark:text-white">
                <ShoppingBag size={17} className="text-acc-primary" /> Top Selling Products
              </h2>
              <div className="flex gap-1.5">
                {(['revenue', 'unitsSold', 'orderCount'] as ProductSortKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setProductSort(key)}
                    className={cn(
                      'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                      productSort === key ? 'bg-acc-primary text-white' : 'bg-primary-100 text-primary-500 dark:bg-primary-800 dark:text-primary-300',
                    )}
                  >
                    <ArrowUpDown size={11} /> {key === 'revenue' ? 'Revenue' : key === 'unitsSold' ? 'Units' : 'Orders'}
                  </button>
                ))}
              </div>
            </div>
            {sortedProducts.length === 0 ? (
              <p className="text-sm text-acc-text-secondary">No product sales data available.</p>
            ) : (
              <div className="space-y-2 overflow-x-auto">
                {sortedProducts.map((p) => (
                  <div key={p.product_id} className="flex items-center gap-3 rounded-xl border border-acc-border px-3 py-2 text-sm dark:border-primary-700">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-acc-text dark:text-white">{p.product_name}</p>
                      <p className="text-xs text-acc-text-secondary">
                        {p.sku ?? 'SKU —'} · {p.category_name} · Stock: {p.currentStock ?? '—'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold text-acc-text dark:text-white">{formatCurrency(p.revenue)}</p>
                      <p className="text-xs text-acc-text-secondary">{p.unitsSold} units · {p.orderCount} orders</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card hover={false}>
            <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-acc-text dark:text-white">
              <AlertTriangle size={17} className="text-acc-primary" /> Low-Performing Products
            </h2>
            <p className="mb-3 text-xs text-acc-text-secondary">Active, in-stock products with below-average units sold this period — out-of-stock and inactive products are excluded.</p>
            {lowPerformers.length === 0 ? (
              <p className="text-sm text-acc-text-secondary">No low-performing products identified for this period.</p>
            ) : (
              <div className="space-y-2">
                {lowPerformers.map((p) => (
                  <div key={p.product_id} className="flex items-center justify-between gap-3 rounded-xl border border-acc-border px-3 py-2 text-sm dark:border-primary-700">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-acc-text dark:text-white">{p.product_name}</p>
                      <p className="text-xs text-acc-text-secondary">{p.category_name} · Stock: {p.currentStock ?? '—'}</p>
                    </div>
                    <p className="shrink-0 text-xs font-semibold text-acc-text-secondary">{p.unitsSold} units sold</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card hover={false}>
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-acc-text dark:text-white">
                <CreditCard size={17} className="text-acc-primary" /> Payment Methods
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-acc-border p-3 dark:border-primary-700">
                  <Banknote size={16} className="mb-1 text-acc-primary" />
                  <p className="text-xs text-acc-text-secondary">Cash on Delivery</p>
                  <p className="font-semibold text-acc-text dark:text-white">{payments.cod.orders} orders · {formatCurrency(payments.cod.revenue)}</p>
                  <p className="mt-1 text-xs text-acc-text-secondary">Pending collection: {formatCurrency(payments.cod.pendingCollection)}</p>
                </div>
                <div className="rounded-xl border border-acc-border p-3 dark:border-primary-700">
                  <CreditCard size={16} className="mb-1 text-acc-primary" />
                  <p className="text-xs text-acc-text-secondary">Online (Razorpay)</p>
                  <p className="font-semibold text-acc-text dark:text-white">{payments.online.orders} orders · {formatCurrency(payments.online.revenue)}</p>
                  {payments.online.failedOrders > 0 && <p className="mt-1 text-xs text-red-500">{payments.online.failedOrders} failed payment(s)</p>}
                </div>
              </div>
            </Card>

            <Card hover={false}>
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-acc-text dark:text-white">
                <Truck size={17} className="text-acc-primary" /> Delivery Performance
              </h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-acc-text-secondary">Delivered</p>
                  <p className="font-semibold text-acc-text dark:text-white">{delivery.deliveredCount}</p>
                </div>
                <div>
                  <p className="text-xs text-acc-text-secondary">Failed</p>
                  <p className="font-semibold text-acc-text dark:text-white">{delivery.failedCount}</p>
                </div>
                <div>
                  <p className="text-xs text-acc-text-secondary">Out for Delivery</p>
                  <p className="font-semibold text-acc-text dark:text-white">{delivery.outForDeliveryCount}</p>
                </div>
                <div>
                  <p className="text-xs text-acc-text-secondary">Pending Assignment</p>
                  <p className="font-semibold text-acc-text dark:text-white">{delivery.pendingAssignmentCount}</p>
                </div>
                <div>
                  <p className="text-xs text-acc-text-secondary">Avg. Completion Time</p>
                  <p className="font-semibold text-acc-text dark:text-white">{delivery.averageCompletionHours === null ? '—' : `${delivery.averageCompletionHours.toFixed(1)}h`}</p>
                </div>
                <div>
                  <p className="text-xs text-acc-text-secondary">Success Rate</p>
                  <p className="font-semibold text-acc-text dark:text-white">{delivery.successRatePercent === null ? '—' : `${delivery.successRatePercent.toFixed(1)}%`}</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card hover={false} className="flex items-center gap-3 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acc-primary/10 text-acc-primary">
                <RotateCcw size={20} />
              </div>
              <div>
                <p className="text-lg font-bold text-acc-text dark:text-white">{returnsSummary.completedCount} completed</p>
                <p className="text-xs text-acc-text-secondary">
                  {returnsSummary.requestCount} requested · {returnsSummary.rejectedCount} rejected · {formatCurrency(returnsSummary.completedValue)} refunded
                </p>
              </div>
            </Card>
            <Card hover={false} className="flex items-center gap-3 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acc-primary/10 text-acc-primary">
                <Repeat size={20} />
              </div>
              <div>
                <p className="text-lg font-bold text-acc-text dark:text-white">{exchangesSummary.completedCount} completed</p>
                <p className="text-xs text-acc-text-secondary">
                  {exchangesSummary.requestCount} requested · {exchangesSummary.rejectedCount} rejected
                </p>
              </div>
            </Card>
            <Card hover={false} className="flex items-center gap-3 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acc-primary/10 text-acc-primary">
                <Users size={20} />
              </div>
              <div>
                {customerSegmentQuery.isLoading ? (
                  <p className="text-sm text-acc-text-secondary">Loading customer segments…</p>
                ) : customerSegmentQuery.data ? (
                  <>
                    <p className="flex items-center gap-3 text-lg font-bold text-acc-text dark:text-white">
                      <span className="flex items-center gap-1"><UserPlus size={14} /> {customerSegmentQuery.data.newCustomers}</span>
                      <span className="flex items-center gap-1"><UserCheck size={14} /> {customerSegmentQuery.data.returningCustomers}</span>
                    </p>
                    <p className="text-xs text-acc-text-secondary">
                      New vs Returning{customerSegmentQuery.data.capped ? ' (sample)' : ''} · {customerSegmentQuery.data.ordersPerCustomer.toFixed(1)} orders/customer
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-acc-text-secondary">Not enough data.</p>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
