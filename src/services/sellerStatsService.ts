import { collection, count, getAggregateFromServer, getDocs, limit, orderBy, query, sum, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, OrderStatus, PaymentMethod } from '@/types';

/** Read-only summary counts for a single seller's own dashboard (products/orders/returns/exchanges scoped to seller_id). */
export interface SellerOverviewStats {
  totalProducts: number;
  activeProducts: number;
  lowStockCount: number;
  totalOrders: number;
  ordersLast30Days: number;
  pendingReturns: number;
  pendingExchanges: number;
}

/** Head-Seller-only platform-wide summary — shown as an extra section on the same dashboard. */
export interface PlatformOverviewStats {
  totalSellers: number;
  pendingApplications: number;
  totalOrders: number;
  totalRevenue: number;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const sellerStatsService = {
  async getSellerOverview(sellerId: string): Promise<SellerOverviewStats> {
    const productsCol = collection(db, 'products');
    const inventoryCol = collection(db, 'inventory');
    const ordersCol = collection(db, 'orders');
    const returnsCol = collection(db, 'returns');
    const exchangesCol = collection(db, 'exchanges');

    const [totalProductsAgg, activeProductsAgg, ordersAgg, pendingReturnsAgg, pendingExchangesAgg, inventorySnap] = await Promise.all([
      getAggregateFromServer(query(productsCol, where('seller_id', '==', sellerId)), { total: count() }),
      getAggregateFromServer(query(productsCol, where('seller_id', '==', sellerId), where('is_active', '==', true)), { total: count() }),
      getAggregateFromServer(query(ordersCol, where('seller_id', '==', sellerId)), { total: count() }),
      getAggregateFromServer(query(returnsCol, where('seller_id', '==', sellerId), where('status', '==', 'requested')), { total: count() }),
      getAggregateFromServer(query(exchangesCol, where('seller_id', '==', sellerId), where('status', '==', 'requested')), { total: count() }),
      // Low-stock needs a per-doc comparison of two fields (total_stock <= low_stock_threshold), which Firestore
      // can't express as a query constraint — fetched and filtered client-side instead.
      getDocs(query(inventoryCol, where('seller_id', '==', sellerId))),
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
      lowStockCount,
      totalOrders: ordersAgg.data().total,
      ordersLast30Days: recentOrdersAgg.data().total,
      pendingReturns: pendingReturnsAgg.data().total,
      pendingExchanges: pendingExchangesAgg.data().total,
    };
  },

  async getPlatformOverview(): Promise<PlatformOverviewStats> {
    const usersCol = collection(db, 'users');
    const sellerRequestsCol = collection(db, 'seller_requests');
    const ordersCol = collection(db, 'orders');

    const [sellersAgg, pendingAgg, ordersAgg, revenueAgg] = await Promise.all([
      getAggregateFromServer(query(usersCol, where('role', 'in', ['seller', 'head_seller'])), { total: count() }),
      getAggregateFromServer(query(sellerRequestsCol, where('status', '==', 'pending')), { total: count() }),
      getAggregateFromServer(ordersCol, { total: count() }),
      getAggregateFromServer(query(ordersCol, where('payment_status', '==', 'paid')), { revenue: sum('total') }),
    ]);

    return {
      totalSellers: sellersAgg.data().total,
      pendingApplications: pendingAgg.data().total,
      totalOrders: ordersAgg.data().total,
      totalRevenue: revenueAgg.data().revenue ?? 0,
    };
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
