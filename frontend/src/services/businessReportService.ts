import { collection, getAggregateFromServer, getDocs, count as fsCount, limit as fsLimit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { productService } from '@/services/productService';
import type { ExchangeRequest, Gender, Inventory, Order, Product, ReturnRequest } from '@/types';

// ---- Date range handling (Section 35: explicit Asia/Kolkata boundaries) ----

/**
 * India has a single fixed UTC+5:30 offset with no DST, so — unlike most timezones — it can be
 * modeled as a constant without a timezone library. This intentionally does NOT use the browser's
 * own configured timezone (`new Date().setHours(0,0,0,0)`, as the older Analytics/Reports pages
 * do) — that happens to read correctly on an India-located device, but isn't robust: a day boundary
 * computed this way would be silently wrong on any device set to a different timezone. Every
 * boundary below is computed explicitly against IST wall-clock time instead.
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function istWallClockParts(date: Date): { y: number; m: number; d: number } {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate() };
}

/** Constructs the real instant (correct in absolute/UTC terms) that corresponds to the given
 *  IST wall-clock date/time — e.g. istDate(2026, 0, 15) is midnight IST on 15 Jan 2026, not UTC. */
function istDate(y: number, m: number, d: number, h = 0, mi = 0, s = 0, ms = 0): Date {
  return new Date(Date.UTC(y, m, d, h, mi, s, ms) - IST_OFFSET_MS);
}

function startOfIstDay(date: Date): Date {
  const { y, m, d } = istWallClockParts(date);
  return istDate(y, m, d);
}

function endOfIstDay(date: Date): Date {
  const { y, m, d } = istWallClockParts(date);
  return istDate(y, m, d, 23, 59, 59, 999);
}

export type RangePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'prevMonth' | 'thisYear' | 'custom';

export const RANGE_PRESET_LABELS: Record<RangePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7: 'Last 7 Days',
  last30: 'Last 30 Days',
  thisMonth: 'This Month',
  prevMonth: 'Previous Month',
  thisYear: 'This Year',
  custom: 'Custom Range',
};

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ResolvedRange {
  current: DateRange;
  /** The immediately-preceding period of the same kind (previous day/7-day block/calendar month/
   *  calendar year) — Section 33's "current vs previous equivalent period." For `thisMonth`/
   *  `thisYear`, `current` only runs to now (the period is still in progress) while `previous` is
   *  the FULL prior calendar month/year, matching the brief's own literal examples ("This month vs
   *  Previous month") rather than a day-count-adjusted "fair" comparison — the UI labels this
   *  plainly so the comparison is never presented as more precise than it is. */
  previous: DateRange;
  label: string;
  /** True for thisMonth/thisYear — `current.end` is "now", not the end of the calendar unit. */
  isPartial: boolean;
}

function previousBlock(start: Date, end: Date): DateRange {
  const durationMs = end.getTime() - start.getTime() + 1;
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs + 1);
  return { start: prevStart, end: prevEnd };
}

export function resolveRangePreset(preset: RangePreset, customStart?: Date, customEnd?: Date): ResolvedRange {
  const now = new Date();

  if (preset === 'today') {
    const start = startOfIstDay(now);
    const end = endOfIstDay(now);
    return { current: { start, end }, previous: previousBlock(start, end), label: 'Today', isPartial: false };
  }
  if (preset === 'yesterday') {
    const y = new Date(startOfIstDay(now).getTime() - 1);
    const start = startOfIstDay(y);
    const end = endOfIstDay(y);
    return { current: { start, end }, previous: previousBlock(start, end), label: 'Yesterday', isPartial: false };
  }
  if (preset === 'last7' || preset === 'last30') {
    const days = preset === 'last7' ? 7 : 30;
    const end = endOfIstDay(now);
    const start = startOfIstDay(new Date(now.getTime() - (days - 1) * DAY_MS));
    return { current: { start, end }, previous: previousBlock(start, end), label: RANGE_PRESET_LABELS[preset], isPartial: false };
  }
  if (preset === 'thisMonth') {
    const { y, m } = istWallClockParts(now);
    const start = istDate(y, m, 1);
    const end = endOfIstDay(now);
    const prevMonthEnd = new Date(start.getTime() - 1);
    const { y: py, m: pm } = istWallClockParts(prevMonthEnd);
    return { current: { start, end }, previous: { start: istDate(py, pm, 1), end: prevMonthEnd }, label: 'This Month', isPartial: true };
  }
  if (preset === 'prevMonth') {
    const { y, m } = istWallClockParts(now);
    const monthStart = istDate(y, m, 1);
    const start = istDate(y, m - 1, 1);
    const end = new Date(monthStart.getTime() - 1);
    return { current: { start, end }, previous: previousBlock(start, end), label: 'Previous Month', isPartial: false };
  }
  if (preset === 'thisYear') {
    const { y } = istWallClockParts(now);
    const start = istDate(y, 0, 1);
    const end = endOfIstDay(now);
    return { current: { start, end }, previous: { start: istDate(y - 1, 0, 1), end: istDate(y - 1, 11, 31, 23, 59, 59, 999) }, label: 'This Year', isPartial: true };
  }
  // custom
  if (!customStart || !customEnd) throw new Error('Custom range requires both a start and end date.');
  const start = startOfIstDay(customStart);
  const end = endOfIstDay(customEnd);
  return { current: { start, end }, previous: previousBlock(start, end), label: 'Custom Range', isPartial: false };
}

// ---- Order fetching ----

/** Sanity cap on a single date-range order fetch — a real Firestore range query on `placed_at`
 *  (date-bounded, not count-bounded, like adminStatsService.getOrdersInRange), but still capped
 *  and the cap disclosed to the owner (same transparency convention as
 *  SellerAnalyticsPage/SellerReportsPage's "figures are computed from the N most recent orders"
 *  notices) rather than silently truncating a very large custom/yearly range. */
const MAX_RANGE_ORDERS = 1500;

export interface RangeOrdersResult {
  orders: Order[];
  capped: boolean;
}

export async function getOrdersForDateRange(sellerId: string, isHeadSeller: boolean, range: DateRange): Promise<RangeOrdersResult> {
  const startIso = range.start.toISOString();
  const endIso = range.end.toISOString();
  const ordersCol = collection(db, 'orders');
  const q = isHeadSeller
    ? query(ordersCol, where('placed_at', '>=', startIso), where('placed_at', '<=', endIso), orderBy('placed_at', 'desc'), fsLimit(MAX_RANGE_ORDERS + 1))
    : query(
        ordersCol,
        where('seller_id', '==', sellerId),
        where('placed_at', '>=', startIso),
        where('placed_at', '<=', endIso),
        orderBy('placed_at', 'desc'),
        fsLimit(MAX_RANGE_ORDERS + 1),
      );
  const snap = await getDocs(q);
  const docs = snap.docs.slice(0, MAX_RANGE_ORDERS);
  return { orders: docs.map((d) => ({ id: d.id, ...d.data() }) as Order), capped: snap.docs.length > MAX_RANGE_ORDERS };
}

// ---- Core aggregation (pure functions over an already-fetched Order[]/Product[]/Inventory[] set) ----

export interface SalesSummary {
  grossSales: number;
  discounts: number;
  netSales: number;
  orderCount: number;
  successfulOrderCount: number;
  unitsSold: number;
  averageOrderValue: number;
}

/** Every figure here is a direct sum/count over real Order fields — no invented accounting rule.
 *  Gross Sales = subtotal (merchandise value before discount/shipping/tax); Net Sales = total (what
 *  the order actually charges) — mirrors exactly how OrderDetailsPage's own payment summary already
 *  labels these same fields, so this doesn't introduce a second definition of "sales" into the app.
 *  Cancelled orders are excluded from every figure here (not "sales" by this app's own order model —
 *  see cancelOrder.ts, which fully reverses their inventory effect); a separate cancellation summary
 *  covers them (see summarizeCancellations below). */
export function summarizeSales(orders: Order[]): SalesSummary {
  const successful = orders.filter((o) => o.status !== 'cancelled');
  const grossSales = successful.reduce((sum, o) => sum + o.subtotal, 0);
  const discounts = successful.reduce((sum, o) => sum + o.discount, 0);
  const netSales = successful.reduce((sum, o) => sum + o.total, 0);
  const unitsSold = successful.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);
  return {
    grossSales,
    discounts,
    netSales,
    orderCount: orders.length,
    successfulOrderCount: successful.length,
    unitsSold,
    averageOrderValue: successful.length > 0 ? netSales / successful.length : 0,
  };
}

export interface CancellationSummary {
  count: number;
  value: number;
  percentOfOrders: number;
}

export function summarizeCancellations(orders: Order[]): CancellationSummary {
  const cancelled = orders.filter((o) => o.status === 'cancelled');
  const value = cancelled.reduce((sum, o) => sum + o.total, 0);
  return { count: cancelled.length, value, percentOfOrders: orders.length > 0 ? (cancelled.length / orders.length) * 100 : 0 };
}

export interface GenderSummary {
  gender: Gender;
  sales: number;
  unitsSold: number;
  orderItemCount: number;
  topProducts: { product_id: string; product_name: string; unitsSold: number; revenue: number }[];
}

/** OrderItem doesn't carry gender directly (only category/brand-adjacent fields), so this joins
 *  each item's product_id against the already-hydrated product map — same join shape
 *  adminStatsService.getCategoryBreakdown already uses for category, just keyed on Product.gender
 *  (a direct field, never inferred from a name/category string) instead. */
export function summarizeByGender(orders: Order[], productsById: Map<string, Product>): GenderSummary[] {
  const successful = orders.filter((o) => o.status !== 'cancelled');
  const byGender = new Map<Gender, { sales: number; unitsSold: number; orderItemCount: number; products: Map<string, { name: string; units: number; revenue: number }> }>();

  for (const order of successful) {
    for (const item of order.items) {
      const gender = productsById.get(item.product_id)?.gender;
      if (!gender) continue;
      const bucket = byGender.get(gender) ?? { sales: 0, unitsSold: 0, orderItemCount: 0, products: new Map() };
      bucket.sales += item.total_price;
      bucket.unitsSold += item.quantity;
      bucket.orderItemCount += 1;
      const p = bucket.products.get(item.product_id) ?? { name: item.product_name, units: 0, revenue: 0 };
      p.units += item.quantity;
      p.revenue += item.total_price;
      bucket.products.set(item.product_id, p);
      byGender.set(gender, bucket);
    }
  }

  return Array.from(byGender.entries()).map(([gender, v]) => ({
    gender,
    sales: v.sales,
    unitsSold: v.unitsSold,
    orderItemCount: v.orderItemCount,
    topProducts: Array.from(v.products.entries())
      .map(([product_id, p]) => ({ product_id, product_name: p.name, unitsSold: p.units, revenue: p.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5),
  }));
}

export interface VariantAttributeRow {
  value: string;
  unitsSold: number;
  revenue: number;
}

/** Color/size performance (Section 15) — entirely from OrderItem.color/size/quantity/total_price,
 *  already denormalized onto every order item, so this needs no product join at all. */
export function summarizeByColorAndSize(orders: Order[]): { colors: VariantAttributeRow[]; sizes: VariantAttributeRow[] } {
  const colors = new Map<string, VariantAttributeRow>();
  const sizes = new Map<string, VariantAttributeRow>();
  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    for (const item of order.items) {
      const c = colors.get(item.color) ?? { value: item.color, unitsSold: 0, revenue: 0 };
      c.unitsSold += item.quantity;
      c.revenue += item.total_price;
      colors.set(item.color, c);
      const s = sizes.get(item.size) ?? { value: item.size, unitsSold: 0, revenue: 0 };
      s.unitsSold += item.quantity;
      s.revenue += item.total_price;
      sizes.set(item.size, s);
    }
  }
  return {
    colors: Array.from(colors.values()).sort((a, b) => b.unitsSold - a.unitsSold),
    sizes: Array.from(sizes.values()).sort((a, b) => b.unitsSold - a.unitsSold),
  };
}

export interface ProductPerformanceRow {
  product_id: string;
  product_name: string;
  sku: string | null;
  category_name: string;
  unitsSold: number;
  revenue: number;
  orderCount: number;
  currentStock: number | null;
}

export type ProductSortKey = 'revenue' | 'unitsSold' | 'orderCount';

/** Top-selling products (Section 12), joined against the already-hydrated product list (category
 *  name) and inventory map (current stock) — sortable by the caller via ProductSortKey. */
export function buildProductPerformance(
  orders: Order[],
  productsById: Map<string, Product>,
  stockByProductId: Map<string, number>,
): ProductPerformanceRow[] {
  const map = new Map<string, { product_name: string; sku: string | null; unitsSold: number; revenue: number; orderIds: Set<string> }>();
  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    for (const item of order.items) {
      const row = map.get(item.product_id) ?? { product_name: item.product_name, sku: item.sku ?? null, unitsSold: 0, revenue: 0, orderIds: new Set<string>() };
      row.unitsSold += item.quantity;
      row.revenue += item.total_price;
      row.orderIds.add(order.id);
      if (!row.sku && item.sku) row.sku = item.sku;
      map.set(item.product_id, row);
    }
  }
  return Array.from(map.entries()).map(([product_id, v]) => ({
    product_id,
    product_name: v.product_name,
    sku: v.sku,
    category_name: productsById.get(product_id)?.category?.name ?? 'Uncategorized',
    unitsSold: v.unitsSold,
    revenue: v.revenue,
    orderCount: v.orderIds.size,
    currentStock: stockByProductId.has(product_id) ? stockByProductId.get(product_id)! : null,
  }));
}

export function sortProductPerformance(rows: ProductPerformanceRow[], sortKey: ProductSortKey): ProductPerformanceRow[] {
  return [...rows].sort((a, b) => b[sortKey] - a[sortKey]);
}

/**
 * Low-performing products (Section 13) — deliberately restricted to products that are ACTIVE and
 * currently IN STOCK; an out-of-stock or inactive product can't have sold regardless of real
 * demand, so it's excluded entirely rather than mislabeled "low performing." Only products with
 * zero or below-average units sold in the period are returned (relative to the scope's own average,
 * not an arbitrary fixed number).
 */
export function findLowPerformingProducts(
  soldRows: ProductPerformanceRow[],
  activeInStockProducts: Product[],
  stockByProductId: Map<string, number>,
  maxResults = 10,
): ProductPerformanceRow[] {
  const soldById = new Map(soldRows.map((r) => [r.product_id, r]));
  const averageUnits = soldRows.length > 0 ? soldRows.reduce((sum, r) => sum + r.unitsSold, 0) / soldRows.length : 0;

  const candidates: ProductPerformanceRow[] = activeInStockProducts.map((p) => {
    const existing = soldById.get(p.id);
    return (
      existing ?? {
        product_id: p.id,
        product_name: p.name,
        sku: p.sku ?? null,
        category_name: p.category?.name ?? 'Uncategorized',
        unitsSold: 0,
        revenue: 0,
        orderCount: 0,
        currentStock: stockByProductId.get(p.id) ?? null,
      }
    );
  });

  return candidates
    .filter((row) => row.unitsSold <= averageUnits)
    .sort((a, b) => a.unitsSold - b.unitsSold)
    .slice(0, maxResults);
}

export interface ReturnExchangeSummary {
  requestCount: number;
  approvedCount: number;
  completedCount: number;
  rejectedCount: number;
  completedValue: number;
}

/** Requested-but-not-yet-resolved statuses never count as "completed" — a return isn't done until
 *  'refunded', an exchange isn't done until 'exchanged' (Sections 21/22's explicit requirement). */
export function summarizeReturns(returns: ReturnRequest[]): ReturnExchangeSummary {
  return {
    requestCount: returns.length,
    approvedCount: returns.filter((r) => ['approved', 'pickup_scheduled', 'received', 'refunded'].includes(r.status)).length,
    completedCount: returns.filter((r) => r.status === 'refunded').length,
    rejectedCount: returns.filter((r) => r.status === 'rejected').length,
    completedValue: returns.filter((r) => r.status === 'refunded').reduce((sum, r) => sum + r.refund_amount, 0),
  };
}

export function summarizeExchanges(exchanges: ExchangeRequest[]): Omit<ReturnExchangeSummary, 'completedValue'> {
  return {
    requestCount: exchanges.length,
    approvedCount: exchanges.filter((e) => ['approved', 'pickup_scheduled', 'exchanged'].includes(e.status)).length,
    completedCount: exchanges.filter((e) => e.status === 'exchanged').length,
    rejectedCount: exchanges.filter((e) => e.status === 'rejected').length,
  };
}

export interface PaymentSummary {
  cod: { orders: number; revenue: number; pendingCollection: number };
  online: { orders: number; revenue: number; failedOrders: number };
}

/** COD "pendingCollection" is every non-cancelled COD order not yet delivered (payment_status stays
 *  'pending' for COD until a future collection-tracking step exists — see the Phase 17 note that no
 *  such step is wired up yet, so this is the honest proxy: not-yet-delivered COD orders' totals). */
export function summarizePayments(orders: Order[]): PaymentSummary {
  const notCancelled = orders.filter((o) => o.status !== 'cancelled');
  const cod = notCancelled.filter((o) => o.payment_method === 'cod');
  const online = notCancelled.filter((o) => o.payment_method === 'razorpay');
  return {
    cod: {
      orders: cod.length,
      revenue: cod.filter((o) => o.status === 'delivered').reduce((sum, o) => sum + o.total, 0),
      pendingCollection: cod.filter((o) => o.status !== 'delivered').reduce((sum, o) => sum + o.total, 0),
    },
    online: {
      orders: online.length,
      revenue: online.filter((o) => o.payment_status === 'paid').reduce((sum, o) => sum + o.total, 0),
      failedOrders: online.filter((o) => o.payment_status === 'failed').length,
    },
  };
}

export interface DeliverySummary {
  deliveredCount: number;
  failedCount: number;
  outForDeliveryCount: number;
  pendingAssignmentCount: number;
  averageCompletionHours: number | null;
  successRatePercent: number | null;
}

/** Delivery success rate = delivered / (delivered + failed) among orders that reached a delivery
 *  outcome at all — orders never assigned a courier are excluded from the denominator (they were
 *  never a delivery attempt to succeed or fail). Average completion time only uses orders with BOTH
 *  real timestamps present, same "don't fabricate" rule Phase 17's SellerDeliveryManagementPage
 *  already established. */
export function summarizeDelivery(orders: Order[]): DeliverySummary {
  const delivered = orders.filter((o) => o.delivery_status === 'delivered');
  const failed = orders.filter((o) => o.delivery_status === 'failed');
  const outForDelivery = orders.filter((o) => o.delivery_status === 'out_for_delivery');
  const pendingAssignment = orders.filter((o) => ['packed', 'shipped'].includes(o.status) && !o.delivery_staff_id);

  const completionHours = delivered
    .filter((o) => o.delivery_assigned_at && o.delivery_delivered_at)
    .map((o) => (new Date(o.delivery_delivered_at!).getTime() - new Date(o.delivery_assigned_at!).getTime()) / 3_600_000)
    .filter((h) => h >= 0);

  const outcomeCount = delivered.length + failed.length;

  return {
    deliveredCount: delivered.length,
    failedCount: failed.length,
    outForDeliveryCount: outForDelivery.length,
    pendingAssignmentCount: pendingAssignment.length,
    averageCompletionHours: completionHours.length > 0 ? completionHours.reduce((s, h) => s + h, 0) / completionHours.length : null,
    successRatePercent: outcomeCount > 0 ? (delivered.length / outcomeCount) * 100 : null,
  };
}

// ---- Period comparison (Section 33) ----

export interface MetricChange {
  current: number;
  previous: number;
  /** null when previous is 0 — a percentage against zero is undefined, not "∞%" or "0%". */
  percentChange: number | null;
}

function changeOf(current: number, previous: number): MetricChange {
  return { current, previous, percentChange: previous > 0 ? ((current - previous) / previous) * 100 : null };
}

export interface PeriodComparison {
  sales: MetricChange;
  orders: MetricChange;
  aov: MetricChange;
  units: MetricChange;
}

export function comparePeriods(current: SalesSummary, previous: SalesSummary): PeriodComparison {
  return {
    sales: changeOf(current.netSales, previous.netSales),
    orders: changeOf(current.successfulOrderCount, previous.successfulOrderCount),
    aov: changeOf(current.averageOrderValue, previous.averageOrderValue),
    units: changeOf(current.unitsSold, previous.unitsSold),
  };
}

/** Deterministic, data-derived sentences only — never an AI-generated business claim (Section 32).
 *  "Not enough historical data" is returned when the previous period is empty (a 0-order previous
 *  period makes any percentage meaningless, not just infinite). */
export function generateBusinessSummary(comparison: PeriodComparison, previousOrderCount: number): string[] {
  if (previousOrderCount === 0) {
    return ['Not enough historical data for comparison — the previous period has no orders to compare against.'];
  }
  const lines: string[] = [];
  const describe = (label: string, m: MetricChange) => {
    if (m.percentChange === null) return `${label}: new activity this period (none in the previous period).`;
    const direction = m.percentChange > 0 ? 'increased' : m.percentChange < 0 ? 'decreased' : 'held steady';
    return `${label} ${direction}${m.percentChange !== 0 ? ` by ${Math.abs(m.percentChange).toFixed(1)}%` : ''} compared with the previous period.`;
  };
  lines.push(describe('Sales', comparison.sales));
  lines.push(describe('Orders', comparison.orders));
  lines.push(describe('Average order value', comparison.aov));
  return lines;
}

// ---- Products / inventory helpers ----

export async function fetchProductsAndStock(sellerId: string, isHeadSeller: boolean): Promise<{ products: Product[]; stockByProductId: Map<string, number> }> {
  const [products, inventorySnap] = await Promise.all([
    isHeadSeller ? productService.listAll() : productService.getBySeller(sellerId),
    getDocs(isHeadSeller ? query(collection(db, 'inventory'), fsLimit(2000)) : query(collection(db, 'inventory'), where('seller_id', '==', sellerId))),
  ]);
  const stockByProductId = new Map<string, number>();
  inventorySnap.docs.forEach((d) => {
    const inv = d.data() as Inventory;
    stockByProductId.set(inv.product_id, inv.total_stock);
  });
  return { products, stockByProductId };
}

// ---- New vs Returning customers (Sections 26/27) ----

export interface CustomerSegmentSummary {
  newCustomers: number;
  returningCustomers: number;
  ordersPerCustomer: number;
  averageOrderValue: number;
  /** True if the distinct-buyer count in this period exceeded the fan-out cap — see the cap
   *  constant below; when true, the split is computed from a random-ish subset order (Map
   *  iteration order), not every buyer, and the UI must disclose this rather than imply certainty. */
  capped: boolean;
}

/** Caps how many distinct buyers get an existence check (Section 36/37: bound the query fan-out).
 *  Realistic for a single shop's per-period customer count; if a date range genuinely has more
 *  distinct buyers than this, the result is disclosed as a sample rather than silently wrong. */
const MAX_CUSTOMER_LOOKUPS = 200;

/**
 * New customer: this buyer's earliest order across ALL time falls inside the selected period.
 * Returning: they have at least one order before the period started. There is no denormalized
 * "first_order_at" anywhere in the schema (confirmed during audit), so this is necessarily an
 * existence check per distinct buyer in the period — `where(buyer_id==X, placed_at &lt; periodStart)`
 * as a count() aggregate (cheap; doesn't download documents), run for at most MAX_CUSTOMER_LOOKUPS
 * distinct buyers in parallel.
 */
export async function classifyNewVsReturning(sellerId: string, isHeadSeller: boolean, periodOrders: Order[], periodStart: Date): Promise<CustomerSegmentSummary> {
  const successful = periodOrders.filter((o) => o.status !== 'cancelled');
  const buyerIds = Array.from(new Set(successful.map((o) => o.buyer_id)));
  const capped = buyerIds.length > MAX_CUSTOMER_LOOKUPS;
  const sampleIds = capped ? buyerIds.slice(0, MAX_CUSTOMER_LOOKUPS) : buyerIds;
  const startIso = periodStart.toISOString();

  const ordersCol = collection(db, 'orders');
  const results = await Promise.all(
    sampleIds.map(async (buyerId) => {
      const constraints = isHeadSeller
        ? [where('buyer_id', '==', buyerId), where('placed_at', '<', startIso)]
        : [where('seller_id', '==', sellerId), where('buyer_id', '==', buyerId), where('placed_at', '<', startIso)];
      const agg = await getAggregateFromServer(query(ordersCol, ...constraints), { total: fsCount() });
      return agg.data().total > 0;
    }),
  );

  const returningCount = results.filter(Boolean).length;
  const newCount = sampleIds.length - returningCount;
  const ordersByBuyer = new Map<string, number>();
  successful.forEach((o) => ordersByBuyer.set(o.buyer_id, (ordersByBuyer.get(o.buyer_id) ?? 0) + 1));
  const totalOrdersForSample = sampleIds.reduce((sum, id) => sum + (ordersByBuyer.get(id) ?? 0), 0);

  return {
    newCustomers: newCount,
    returningCustomers: returningCount,
    ordersPerCustomer: sampleIds.length > 0 ? totalOrdersForSample / sampleIds.length : 0,
    averageOrderValue: summarizeSales(successful.filter((o) => sampleIds.includes(o.buyer_id))).averageOrderValue,
    capped,
  };
}
