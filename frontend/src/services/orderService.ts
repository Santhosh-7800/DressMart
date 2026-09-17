import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, updateDoc, where, type QueryConstraint, type Unsubscribe } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import type { Order, OrderStatus, OrderTimelineEvent } from '@/types';

const ORDERS_COLLECTION = 'orders';

export const STATUS_LABELS: Record<OrderStatus, string> = {
  placed: 'Order Placed',
  confirmed: 'Order Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

/** Forward-only fulfillment progression a seller can advance an order through. */
export const HAPPY_PATH: OrderStatus[] = ['placed', 'confirmed', 'packed', 'shipped', 'delivered'];

function toOrder(snap: { id: string; data: () => Record<string, unknown> }): Order {
  return { id: snap.id, ...snap.data() } as Order;
}

export interface AdvanceStatusInput {
  nextStatus: OrderStatus;
  note?: string;
  trackingNumber?: string;
  courierName?: string;
  courierPhone?: string;
}

export const orderService = {
  // ---- Buyer ----

  async listForBuyer(buyerId: string): Promise<Order[]> {
    const snap = await getDocs(query(collection(db, ORDERS_COLLECTION), where('buyer_id', '==', buyerId), orderBy('placed_at', 'desc')));
    return snap.docs.map(toOrder);
  },

  async getById(orderId: string): Promise<Order | null> {
    const snap = await getDoc(doc(db, ORDERS_COLLECTION, orderId));
    return snap.exists() ? toOrder(snap) : null;
  },

  /** All seller-scoped shipments sharing one checkout — same group_id, same order_number. */
  async listByGroup(buyerId: string, groupId: string): Promise<Order[]> {
    const snap = await getDocs(query(collection(db, ORDERS_COLLECTION), where('buyer_id', '==', buyerId), where('group_id', '==', groupId)));
    return snap.docs.map(toOrder);
  },

  async listByOrderNumber(buyerId: string, orderNumber: string): Promise<Order[]> {
    const snap = await getDocs(query(collection(db, ORDERS_COLLECTION), where('buyer_id', '==', buyerId), where('order_number', '==', orderNumber)));
    return snap.docs.map(toOrder);
  },

  /** Realtime — buyer's own orders list updates live as a seller advances status, no polling. */
  subscribeForBuyer(buyerId: string, callback: (orders: Order[]) => void): Unsubscribe {
    const q = query(collection(db, ORDERS_COLLECTION), where('buyer_id', '==', buyerId), orderBy('placed_at', 'desc'));
    return onSnapshot(q, (snap) => callback(snap.docs.map(toOrder)));
  },

  /** Realtime — single order detail/tracking page. */
  subscribeToOrder(orderId: string, callback: (order: Order | null) => void): Unsubscribe {
    return onSnapshot(doc(db, ORDERS_COLLECTION, orderId), (snap) => callback(snap.exists() ? toOrder(snap) : null));
  },

  /** Realtime — every seller-scoped shipment sharing one checkout (order success/tracking pages). */
  subscribeToOrderGroup(buyerId: string, groupId: string, callback: (orders: Order[]) => void): Unsubscribe {
    const q = query(collection(db, ORDERS_COLLECTION), where('buyer_id', '==', buyerId), where('group_id', '==', groupId));
    return onSnapshot(q, (snap) => callback(snap.docs.map(toOrder)));
  },

  /** Buyer-only, pre-shipping cancellation — runs through the Cloud Function so inventory restock happens atomically. */
  async cancel(orderId: string): Promise<{ success: true }> {
    const call = httpsCallable<{ orderId: string }, { success: true }>(functions, 'cancelOrder');
    const res = await call({ orderId });
    return res.data;
  },

  // ---- Seller / Head Seller ----

  /** Head Seller sees every order platform-wide (per firestore.rules); a regular seller only their own. */
  async listForSeller(sellerId: string, isHeadSeller: boolean): Promise<Order[]> {
    const q = isHeadSeller
      ? query(collection(db, ORDERS_COLLECTION), orderBy('placed_at', 'desc'))
      : query(collection(db, ORDERS_COLLECTION), where('seller_id', '==', sellerId), orderBy('placed_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(toOrder);
  },

  /** Realtime — seller's own order queue (or, for Head Seller, every order) updates live as buyers place/cancel orders. */
  subscribeForSeller(sellerId: string, isHeadSeller: boolean, callback: (orders: Order[]) => void): Unsubscribe {
    const q = isHeadSeller
      ? query(collection(db, ORDERS_COLLECTION), orderBy('placed_at', 'desc'))
      : query(collection(db, ORDERS_COLLECTION), where('seller_id', '==', sellerId), orderBy('placed_at', 'desc'));
    return onSnapshot(q, (snap) => callback(snap.docs.map(toOrder)));
  },

  /**
   * Realtime, bounded, and status-scoped (Phase 17) — SellerOrdersPage's main query, replacing its
   * prior use of the fully unbounded `subscribeForSeller` above (which, for a Head Seller, was a
   * live listener over the ENTIRE orders collection with no limit at all). A status filter narrows
   * the query server-side — selecting "Delivered" only ever reads delivered orders, never the whole
   * collection — and "All" still applies `limit(maxDocs)` so a single listener can't silently
   * balloon as order volume grows. "Load more" bumps `maxDocs` and re-subscribes rather than
   * tracking a separate cursor, the same bump-limit() approach `subscribeRecentForSeller` already
   * uses for the Dashboard's recent-orders feed — simpler than cursor pagination and compatible
   * with staying realtime.
   */
  subscribeOrdersForSellerPaged(
    sellerId: string,
    isHeadSeller: boolean,
    statusFilter: OrderStatus | 'all',
    maxDocs: number,
    callback: (orders: Order[]) => void,
  ): Unsubscribe {
    const constraints: QueryConstraint[] = [];
    if (!isHeadSeller) constraints.push(where('seller_id', '==', sellerId));
    if (statusFilter !== 'all') constraints.push(where('status', '==', statusFilter));
    constraints.push(orderBy('placed_at', 'desc'), limit(maxDocs));
    const q = query(collection(db, ORDERS_COLLECTION), ...constraints);
    return onSnapshot(q, (snap) => callback(snap.docs.map(toOrder)));
  },

  /** Realtime, bounded (limit 10) — the Dashboard's "Recent Orders" feed. Deliberately a separate
   *  method from the unbounded `subscribeForSeller` (which SellerOrdersPage relies on for its full
   *  queue) so a bounded `limit()` never needs to be retrofitted onto that existing, working query. */
  subscribeRecentForSeller(sellerId: string, isHeadSeller: boolean, maxDocs: number, callback: (orders: Order[]) => void): Unsubscribe {
    const q = isHeadSeller
      ? query(collection(db, ORDERS_COLLECTION), orderBy('placed_at', 'desc'), limit(maxDocs))
      : query(collection(db, ORDERS_COLLECTION), where('seller_id', '==', sellerId), orderBy('placed_at', 'desc'), limit(maxDocs));
    return onSnapshot(q, (snap) => callback(snap.docs.map(toOrder)));
  },

  /** Plain Firestore update — firestore.rules already allow the Admin to advance status/tracking
   *  fields directly. A Firestore-trigger Cloud Function (owned elsewhere)
   *  fires the buyer notification off this write, so no notification doc is created here. */
  async advanceStatus(order: Order, input: AdvanceStatusInput): Promise<void> {
    const event: OrderTimelineEvent = {
      status: input.nextStatus,
      label: STATUS_LABELS[input.nextStatus],
      timestamp: new Date().toISOString(),
      ...(input.note ? { note: input.note } : {}),
    };
    const updates: Record<string, unknown> = { status: input.nextStatus, timeline: [...(order.timeline ?? []), event] };
    if (input.trackingNumber) updates.tracking_number = input.trackingNumber;
    if (input.courierName) updates.courier_name = input.courierName;
    if (input.courierPhone) updates.courier_phone = input.courierPhone;
    await updateDoc(doc(db, ORDERS_COLLECTION, order.id), updates);
  },

  nextStatus(current: OrderStatus): OrderStatus | null {
    const idx = HAPPY_PATH.indexOf(current);
    if (idx === -1 || idx === HAPPY_PATH.length - 1) return null;
    return HAPPY_PATH[idx + 1];
  },
};
