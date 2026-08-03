import { collection, count, getAggregateFromServer, getDocs, limit, orderBy, query, sum, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { reviewService } from './reviewService';
import { listActiveCoupons } from './couponService';
import { productService } from './productService';
import type { Inventory, Order, OrderStatus, PaymentMethod, Product } from '@/types';

/** Read-only summary counts for a single seller's own dashboard (products/orders/returns/exchanges scoped to seller_id). */
export interface SellerOverviewStats {
  totalProducts: number;
  activeProducts: number;
  outOfStockProducts: number;
  flashSaleProducts: number;
  lowStockCount: number;
  totalOrders: number;
  ordersLast30Days: number;
  pendingOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  pendingReturns: number;
  pendingExchanges: number;
  totalRevenue: number;
  todayOrders: number;
  todayRevenue: number;
  monthRevenue: number;
  averageRating: number;
  unrepliedReviews: number;
}

/** Head-Seller-only platform-wide summary — shown as an extra section on the same dashboard. */
export interface PlatformOverviewStats {
  totalSellers: number;
  pendingApplications: number;
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  staffMembers: number;
  couponsActive: number;
  todayOrders: number;
  todayRevenue: number;
  monthRevenue: number;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfMonthIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** One count() + one sum('total') aggregate for orders placed since `sinceIso`, scoped to a single
 *  seller unless `isHeadSeller` (platform-wide). Both cheap aggregate reads, not a doc download. */
async function ordersSince(sellerId: string, isHeadSeller: boolean, sinceIso: string): Promise<{ orders: number; revenue: number }> {
  const ordersCol = collection(db, 'orders');
  const base = isHeadSeller ? [where('placed_at', '>=', sinceIso)] : [where('seller_id', '==', sellerId), where('placed_at', '>=', sinceIso)];
  const [ordersAgg, revenueAgg] = await Promise.all([
    getAggregateFromServer(query(ordersCol, ...base), { total: count() }),
    getAggregateFromServer(query(ordersCol, ...base, where('payment_status', '==', 'paid')), { revenue: sum('total') }),
  ]);
  return { orders: ordersAgg.data().total, revenue: revenueAgg.data().revenue ?? 0 };
}

/** One count() aggregate per OrderStatus, scoped to a single seller unless `isHeadSeller`. All run
 *  in parallel — cheap aggregate reads, not a doc download; avoids the accuracy cap a bounded
 *  recent-orders slice would have for a Head Seller viewing platform-wide counts. */
async function orderStatusCounts(sellerId: string, isHeadSeller: boolean, statuses: OrderStatus[]): Promise<Record<OrderStatus, number>> {
  const ordersCol = collection(db, 'orders');
  const entries = await Promise.all(
    statuses.map(async (status) => {
      const constraints = isHeadSeller
        ? [where('status', '==', status)]
        : [where('seller_id', '==', sellerId), where('status', '==', status)];
      const agg = await getAggregateFromServer(query(ordersCol, ...constraints), { total: count() });
      return [status, agg.data().total] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<OrderStatus, number>;
}

export const sellerStatsService = {
  async getSellerOverview(sellerId: string): Promise<SellerOverviewStats> {
    const productsCol = collection(db, 'products');
    const inventoryCol = collection(db, 'inventory');
    const ordersCol = collection(db, 'orders');
    const returnsCol = collection(db, 'returns');
    const exchangesCol = collection(db, 'exchanges');

    const [
      totalProductsAgg,
      activeProductsAgg,
      outOfStockAgg,
      flashSaleAgg,
      ordersAgg,
      revenueAgg,
      pendingReturnsAgg,
      returnedOrdersAgg,
      pendingExchangesAgg,
      inventorySnap,
      statusCounts,
      todayStats,
      monthStats,
      ratingOverview,
    ] = await Promise.all([
      getAggregateFromServer(query(productsCol, where('seller_id', '==', sellerId)), { total: count() }),
      getAggregateFromServer(query(productsCol, where('seller_id', '==', sellerId), where('is_active', '==', true)), { total: count() }),
      getAggregateFromServer(query(productsCol, where('seller_id', '==', sellerId), where('status', '==', 'out_of_stock')), { total: count() }),
      getAggregateFromServer(query(productsCol, where('seller_id', '==', sellerId), where('is_deal_of_day', '==', true)), { total: count() }),
      getAggregateFromServer(query(ordersCol, where('seller_id', '==', sellerId)), { total: count() }),
      getAggregateFromServer(query(ordersCol, where('seller_id', '==', sellerId), where('payment_status', '==', 'paid')), { revenue: sum('total') }),
      getAggregateFromServer(query(returnsCol, where('seller_id', '==', sellerId), where('status', '==', 'requested')), { total: count() }),
      getAggregateFromServer(query(returnsCol, where('seller_id', '==', sellerId), where('status', '==', 'refunded')), { total: count() }),
      getAggregateFromServer(query(exchangesCol, where('seller_id', '==', sellerId), where('status', '==', 'requested')), { total: count() }),
      // Low-stock needs a per-doc comparison of two fields (total_stock <= low_stock_threshold), which Firestore
      // can't express as a query constraint — fetched and filtered client-side instead.
      getDocs(query(inventoryCol, where('seller_id', '==', sellerId))),
      orderStatusCounts(sellerId, false, ['placed', 'delivered', 'cancelled']),
      ordersSince(sellerId, false, startOfTodayIso()),
      ordersSince(sellerId, false, startOfMonthIso()),
      reviewService.getSellerRatingOverview(sellerId),
    ]);

    const cutoffIso = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
    const recentOrdersAgg = await getAggregateFromServer(
      query(ordersCol, where('seller_id', '==', sellerId), where('placed_at', '>=', cutoffIso)),
      { total: count() },
    );

    const lowStockCount = inventorySnap.docs.filter((d) => {
      const data = d.data() as { total_stock: number; low_stock_threshold: number };
      return data.total_stock <= data.low_stock_threshold;
    }).length;

    return {
      totalProducts: totalProductsAgg.data().total,
      activeProducts: activeProductsAgg.data().total,
      outOfStockProducts: outOfStockAgg.data().total,
      flashSaleProducts: flashSaleAgg.data().total,
      lowStockCount,
      totalOrders: ordersAgg.data().total,
      ordersLast30Days: recentOrdersAgg.data().total,
      pendingOrders: statusCounts.placed,
      deliveredOrders: statusCounts.delivered,
      cancelledOrders: statusCounts.cancelled,
      returnedOrders: returnedOrdersAgg.data().total,
      pendingReturns: pendingReturnsAgg.data().total,
      pendingExchanges: pendingExchangesAgg.data().total,
      totalRevenue: revenueAgg.data().revenue ?? 0,
      todayOrders: todayStats.orders,
      todayRevenue: todayStats.revenue,
      monthRevenue: monthStats.revenue,
      averageRating: ratingOverview.averageRating,
      unrepliedReviews: ratingOverview.unrepliedCount,
    };
  },

  async getPlatformOverview(): Promise<PlatformOverviewStats> {
    const usersCol = collection(db, 'users');
    const sellerRequestsCol = collection(db, 'seller_requests');
    const ordersCol = collection(db, 'orders');

    const [sellersAgg, pendingAgg, ordersAgg, revenueAgg, customersAgg, staffAgg, activeCoupons, todayStats, monthStats] = await Promise.all([
      getAggregateFromServer(query(usersCol, where('role', 'in', ['seller', 'head_seller'])), { total: count() }),
      getAggregateFromServer(query(sellerRequestsCol, where('status', '==', 'pending')), { total: count() }),
      getAggregateFromServer(ordersCol, { total: count() }),
      getAggregateFromServer(query(ordersCol, where('payment_status', '==', 'paid')), { revenue: sum('total') }),
      getAggregateFromServer(query(usersCol, where('role', '==', 'buyer')), { total: count() }),
      getAggregateFromServer(query(usersCol, where('role', '==', 'staff')), { total: count() }),
      listActiveCoupons(),
      ordersSince('', true, startOfTodayIso()),
      ordersSince('', true, startOfMonthIso()),
    ]);

    return {
      totalSellers: sellersAgg.data().total,
      pendingApplications: pendingAgg.data().total,
      totalOrders: ordersAgg.data().total,
      totalRevenue: revenueAgg.data().revenue ?? 0,
      totalCustomers: customersAgg.data().total,
      staffMembers: staffAgg.data().total,
      couponsActive: activeCoupons.length,
      todayOrders: todayStats.orders,
      todayRevenue: todayStats.revenue,
      monthRevenue: monthStats.revenue,
    };
  },

  /** Standalone order-status breakdown (every OrderStatus, not just the 3 folded into
   *  getSellerOverview) — used by OrdersStatusSummary for the full per-status tile row. */
  async getOrderStatusBreakdown(sellerId: string, isHeadSeller: boolean): Promise<Record<OrderStatus, number>> {
    const ALL_STATUSES: OrderStatus[] = ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'];
    return orderStatusCounts(sellerId, isHeadSeller, ALL_STATUSES);
  },

  /** Low-stock products (0 < total_stock <= low_stock_threshold), joined with product name/image —
   *  InventorySummary needs the actual list, not just the count `getSellerOverview` already has. */
  async listLowStock(sellerId: string, maxResults = 10): Promise<{ product: Product; inventory: Inventory }[]> {
    const [inventorySnap, products] = await Promise.all([
      getDocs(query(collection(db, 'inventory'), where('seller_id', '==', sellerId))),
      productService.getBySeller(sellerId),
    ]);
    const productsById = new Map(products.map((p) => [p.id, p]));
    const rows: { product: Product; inventory: Inventory }[] = [];
    inventorySnap.docs.forEach((d) => {
      const inv = d.data() as Inventory;
      const product = productsById.get(inv.product_id);
      if (product && inv.total_stock > 0 && inv.total_stock <= inv.low_stock_threshold) rows.push({ product, inventory: inv });
    });
    return rows.sort((a, b) => a.inventory.total_stock - b.inventory.total_stock).slice(0, maxResults);
  },

  /** Fully out-of-stock products (total_stock === 0), same join as listLowStock. */
  async listOutOfStock(sellerId: string, maxResults = 10): Promise<{ product: Product; inventory: Inventory }[]> {
    const [inventorySnap, products] = await Promise.all([
      getDocs(query(collection(db, 'inventory'), where('seller_id', '==', sellerId))),
      productService.getBySeller(sellerId),
    ]);
    const productsById = new Map(products.map((p) => [p.id, p]));
    const rows: { product: Product; inventory: Inventory }[] = [];
    inventorySnap.docs.forEach((d) => {
      const inv = d.data() as Inventory;
      const product = productsById.get(inv.product_id);
      if (product && inv.total_stock === 0) rows.push({ product, inventory: inv });
    });
    return rows.slice(0, maxResults);
  },

  /** Deal-of-the-day products whose `deal_ends_at` falls within the next `withinDays` — apparel has
   *  no real expiry date, so this substitutes for "Expiring Products" using the field that actually
   *  exists (see the redesign plan's schema-gap decision #4). */
  async listDealsEndingSoon(sellerId: string, withinDays = 3): Promise<Product[]> {
    const cutoff = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000).toISOString();
    const snap = await getDocs(
      query(collection(db, 'products'), where('seller_id', '==', sellerId), where('is_deal_of_day', '==', true), where('deal_ends_at', '<=', cutoff)),
    );
    return snap.docs.map((d) => d.data() as Product);
  },

  /** Most recently added products for this seller — InventorySummary's "Recently Added" list. */
  async listRecentlyAdded(sellerId: string, maxResults = 5): Promise<Product[]> {
    const snap = await getDocs(
      query(collection(db, 'products'), where('seller_id', '==', sellerId), orderBy('created_at', 'desc'), limit(maxResults)),
    );
    return snap.docs.map((d) => d.data() as Product);
  },

  /** Top-selling products by units sold, derived from a bounded recent-orders scan (reuses the same
   *  topProductsFromOrders helper the Analytics page already uses) — InventorySummary's "Top Selling" list. */
  async listTopSelling(sellerId: string, isHeadSeller: boolean, maxResults = 5): Promise<TopProductRow[]> {
    const ordersCol = collection(db, 'orders');
    const q = isHeadSeller
      ? query(ordersCol, orderBy('placed_at', 'desc'), limit(500))
      : query(ordersCol, where('seller_id', '==', sellerId), orderBy('placed_at', 'desc'), limit(500));
    const snap = await getDocs(q);
    const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order);
    return topProductsFromOrders(orders, maxResults);
  },

  /**
   * Bounded, most-recent slice of platform-wide orders for the Analytics/Reports pages to aggregate
   * client-side (status breakdown, top sellers/products, revenue over time, payment mix). Fine at this
   * app's scale; a real analytics pipeline would pre-aggregate instead of scanning raw order docs.
   */
  async fetchRecentOrders(maxDocs = 500): Promise<Order[]> {
    const snap = await getDocs(query(collection(db, 'orders'), orderBy('placed_at', 'desc'), limit(maxDocs)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order);
  },

  /** Every order placed in the last `days` days — date-bounded (not count-bounded, unlike
   *  fetchRecentOrders), so the "Sales Last 7/30 Days" and "Monthly Revenue" charts never silently
   *  miss recent days the way a 500-doc-cap slice could for a very active seller. Feed the result
   *  into groupOrdersByDay/groupOrdersByMonth below. */
  async getOrdersInRange(sellerId: string, isHeadSeller: boolean, days: number): Promise<Order[]> {
    const cutoffIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const q = isHeadSeller
      ? query(collection(db, 'orders'), where('placed_at', '>=', cutoffIso))
      : query(collection(db, 'orders'), where('seller_id', '==', sellerId), where('placed_at', '>=', cutoffIso));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order);
  },

  /** New buyer or seller/head-seller signups per day over the last `days` days — Customer Growth /
   *  Seller Growth charts. */
  async getUserGrowth(days: number, roles: string[]): Promise<{ date: string; count: number }[]> {
    const cutoffIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const usersCol = collection(db, 'users');
    const roleFilter = roles.length > 1 ? where('role', 'in', roles) : where('role', '==', roles[0]);
    const snap = await getDocs(query(usersCol, roleFilter, where('created_at', '>=', cutoffIso)));
    const buckets = new Map<string, number>();
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }
    snap.docs.forEach((d) => {
      const day = (d.data().created_at as string | undefined)?.slice(0, 10);
      if (day && buckets.has(day)) buckets.set(day, (buckets.get(day) ?? 0) + 1);
    });
    return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
  },

  /** Units sold + revenue grouped by category, for this seller (or platform-wide for a Head
   *  Seller) — joins order items' product_id against the already-hydrated product list (which
   *  carries `.category` — see productService.hydrate) rather than a second Firestore round-trip. */
  async getCategoryBreakdown(sellerId: string, isHeadSeller: boolean, topN = 8): Promise<{ category_name: string; units_sold: number; revenue: number }[]> {
    const [orders, products] = await Promise.all([
      getDocs(
        isHeadSeller
          ? query(collection(db, 'orders'), orderBy('placed_at', 'desc'), limit(500))
          : query(collection(db, 'orders'), where('seller_id', '==', sellerId), orderBy('placed_at', 'desc'), limit(500)),
      ).then((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)),
      isHeadSeller ? productService.listAll() : productService.getBySeller(sellerId),
    ]);

    const categoryByProduct = new Map(products.map((p) => [p.id, p.category?.name ?? 'Uncategorized']));
    const totals = new Map<string, { units_sold: number; revenue: number }>();
    orders.forEach((order) => {
      order.items.forEach((item) => {
        const categoryName = categoryByProduct.get(item.product_id) ?? 'Uncategorized';
        const row = totals.get(categoryName) ?? { units_sold: 0, revenue: 0 };
        row.units_sold += item.quantity;
        row.revenue += item.total_price;
        totals.set(categoryName, row);
      });
    });

    return Array.from(totals.entries())
      .map(([category_name, v]) => ({ category_name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, topN);
  },
};

// ---- Pure aggregation helpers over an already-fetched Order[] slice (used by Analytics/Reports pages) ----

export function groupOrdersByStatus(orders: Order[]): Record<OrderStatus, number> {
  const result = {} as Record<OrderStatus, number>;
  for (const order of orders) {
    result[order.status] = (result[order.status] ?? 0) + 1;
  }
  return result;
}

export function groupOrdersByDay(orders: Order[], days = 14): { date: string; count: number; revenue: number }[] {
  const buckets = new Map<string, { count: number; revenue: number }>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), { count: 0, revenue: 0 });
  }
  for (const order of orders) {
    const day = order.placed_at?.slice(0, 10);
    const bucket = day ? buckets.get(day) : undefined;
    if (bucket) {
      bucket.count += 1;
      bucket.revenue += order.total;
    }
  }
  return Array.from(buckets.entries()).map(([date, v]) => ({ date, ...v }));
}

/** Same shape as groupOrdersByDay, bucketed by calendar month instead — "Monthly Revenue" chart. */
export function groupOrdersByMonth(orders: Order[], months = 6): { month: string; count: number; revenue: number }[] {
  const buckets = new Map<string, { count: number; revenue: number }>();
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    buckets.set(d.toISOString().slice(0, 7), { count: 0, revenue: 0 });
  }
  for (const order of orders) {
    const month = order.placed_at?.slice(0, 7);
    const bucket = month ? buckets.get(month) : undefined;
    if (bucket) {
      bucket.count += 1;
      bucket.revenue += order.total;
    }
  }
  return Array.from(buckets.entries()).map(([month, v]) => ({ month, ...v }));
}

export interface TopProductRow {
  product_id: string;
  product_name: string;
  units_sold: number;
  revenue: number;
}

export function topProductsFromOrders(orders: Order[], topN = 10): TopProductRow[] {
  const map = new Map<string, TopProductRow>();
  for (const order of orders) {
    for (const item of order.items) {
      const row = map.get(item.product_id) ?? { product_id: item.product_id, product_name: item.product_name, units_sold: 0, revenue: 0 };
      row.units_sold += item.quantity;
      row.revenue += item.total_price;
      map.set(item.product_id, row);
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.units_sold - a.units_sold)
    .slice(0, topN);
}

export interface TopBrandRow {
  brand_name: string;
  units_sold: number;
  revenue: number;
}

/** Same shape as topProductsFromOrders, grouped by brand instead — OrderItem already carries
 *  brand_name directly, no product join needed (unlike category, which isn't on OrderItem). */
export function topBrandsFromOrders(orders: Order[], topN = 10): TopBrandRow[] {
  const map = new Map<string, TopBrandRow>();
  for (const order of orders) {
    for (const item of order.items) {
      const row = map.get(item.brand_name) ?? { brand_name: item.brand_name, units_sold: 0, revenue: 0 };
      row.units_sold += item.quantity;
      row.revenue += item.total_price;
      map.set(item.brand_name, row);
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, topN);
}

export interface SellerRevenueRow {
  seller_id: string;
  orders: number;
  revenue: number;
}

export function revenueBySeller(orders: Order[]): SellerRevenueRow[] {
  const map = new Map<string, SellerRevenueRow>();
  for (const order of orders) {
    const row = map.get(order.seller_id) ?? { seller_id: order.seller_id, orders: 0, revenue: 0 };
    row.orders += 1;
    row.revenue += order.total;
    map.set(order.seller_id, row);
  }
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

export function paymentMethodBreakdown(orders: Order[]): Record<PaymentMethod, { orders: number; revenue: number }> {
  const result: Record<PaymentMethod, { orders: number; revenue: number }> = {
    cod: { orders: 0, revenue: 0 },
    razorpay: { orders: 0, revenue: 0 },
  };
  for (const order of orders) {
    result[order.payment_method].orders += 1;
    result[order.payment_method].revenue += order.total;
  }
  return result;
}

export function totalRevenueOf(orders: Order[]): number {
  return orders.reduce((sum_, o) => sum_ + o.total, 0);
}
