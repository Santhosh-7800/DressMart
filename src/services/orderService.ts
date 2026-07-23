import { collection, doc, getDoc, getDocs, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import type { Order, OrderStatus, OrderTimelineEvent } from '@/types';

const ORDERS_COLLECTION = 'orders';

export const STATUS_LABELS: Record<OrderStatus, string> = {
  placed: 'Order Placed',
  confirmed: 'Order Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

/** Forward-only fulfillment progression a seller can advance an order through. */
export const HAPPY_PATH: OrderStatus[] = ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered'];

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

  /** Plain Firestore update — firestore.rules already allow the owning seller_id (or head_seller) to
   *  advance status/tracking fields directly. A Firestore-trigger Cloud Function (owned elsewhere)
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
