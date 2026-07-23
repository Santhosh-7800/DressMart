import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, updateDoc, where, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ExchangeRequest, ExchangeStatus, Order, OrderItem } from '@/types';
import { EXCHANGE_STATUS_LABELS } from '@/lib/exchangeStatus';

const EXCHANGES_COLLECTION = 'exchanges';
const ORDERS_COLLECTION = 'orders';

function toExchange(snap: { id: string; data: () => Record<string, unknown> }): ExchangeRequest {
  return { id: snap.id, ...snap.data() } as ExchangeRequest;
}

/** OrderItem.exchange_status is a narrower enum than ExchangeStatus (no pickup_scheduled — folded
 *  into 'approved' for the item-level summary shown on order pages). */
function toOrderItemExchangeStatus(status: ExchangeStatus): OrderItem['exchange_status'] {
  switch (status) {
    case 'requested':
      return 'requested';
    case 'approved':
    case 'pickup_scheduled':
      return 'approved';
    case 'exchanged':
      return 'exchanged';
    case 'rejected':
      return 'rejected';
  }
}

async function mirrorItemExchangeStatus(orderId: string, orderItemId: string, status: ExchangeStatus): Promise<void> {
  const orderSnap = await getDoc(doc(db, ORDERS_COLLECTION, orderId));
  if (!orderSnap.exists()) return;
  const order = orderSnap.data() as Order;
  const items = order.items.map((item) => (item.id === orderItemId ? { ...item, exchange_status: toOrderItemExchangeStatus(status) } : item));
  await updateDoc(doc(db, ORDERS_COLLECTION, orderId), { items });
}

export interface RequestExchangeInput {
  order: Order;
  orderItemId: string;
  reason: string;
  comment: string;
  desiredVariantId: string;
  desiredSize: string;
  desiredColor: string;
}

export const exchangeService = {
  async listForBuyer(buyerId: string): Promise<ExchangeRequest[]> {
    const snap = await getDocs(query(collection(db, EXCHANGES_COLLECTION), where('buyer_id', '==', buyerId), orderBy('created_at', 'desc')));
    return snap.docs.map(toExchange);
  },

  /** Head Seller sees every exchange platform-wide (per firestore.rules); a regular seller only their own. */
  async listForSeller(sellerId: string, isHeadSeller: boolean): Promise<ExchangeRequest[]> {
    const q = isHeadSeller
      ? query(collection(db, EXCHANGES_COLLECTION), orderBy('created_at', 'desc'))
      : query(collection(db, EXCHANGES_COLLECTION), where('seller_id', '==', sellerId), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(toExchange);
  },

  /** Realtime — buyer's own exchange requests update live as a seller approves/rejects/advances them. */
  subscribeForBuyer(buyerId: string, callback: (exchanges: ExchangeRequest[]) => void): Unsubscribe {
    const q = query(collection(db, EXCHANGES_COLLECTION), where('buyer_id', '==', buyerId), orderBy('created_at', 'desc'));
    return onSnapshot(q, (snap) => callback(snap.docs.map(toExchange)));
  },

  /** Realtime — seller's own exchange queue (or, for Head Seller, every exchange) updates live as buyers submit requests. */
  subscribeForSeller(sellerId: string, isHeadSeller: boolean, callback: (exchanges: ExchangeRequest[]) => void): Unsubscribe {
    const q = isHeadSeller
      ? query(collection(db, EXCHANGES_COLLECTION), orderBy('created_at', 'desc'))
      : query(collection(db, EXCHANGES_COLLECTION), where('seller_id', '==', sellerId), orderBy('created_at', 'desc'));
    return onSnapshot(q, (snap) => callback(snap.docs.map(toExchange)));
  },

  async request(buyerId: string, input: RequestExchangeInput): Promise<ExchangeRequest> {
    const item = input.order.items.find((i) => i.id === input.orderItemId);
    if (!item) throw new Error('Order item not found.');

    const now = new Date().toISOString();
    const payload = {
      order_id: input.order.id,
      order_item_id: input.orderItemId,
      buyer_id: buyerId,
      seller_id: item.seller_id,
      reason: input.reason,
      comment: input.comment || null,
      desired_variant_id: input.desiredVariantId,
      desired_size: input.desiredSize,
      desired_color: input.desiredColor,
      status: 'requested' as ExchangeStatus,
      timeline: [{ status: 'requested' as ExchangeStatus, label: EXCHANGE_STATUS_LABELS.requested, timestamp: now }],
      created_at: now,
    };
    const ref = await addDoc(collection(db, EXCHANGES_COLLECTION), payload);
    await mirrorItemExchangeStatus(input.order.id, input.orderItemId, 'requested');
    return { id: ref.id, ...payload };
  },

  /** Seller/head-seller fulfillment action (plain updateDoc — rules already allow the owning seller_id / head_seller to write). */
  async advanceStatus(exchangeRequest: ExchangeRequest, nextStatus: ExchangeStatus): Promise<void> {
    const event = { status: nextStatus, label: EXCHANGE_STATUS_LABELS[nextStatus], timestamp: new Date().toISOString() };
    await updateDoc(doc(db, EXCHANGES_COLLECTION, exchangeRequest.id), {
      status: nextStatus,
      timeline: [...(exchangeRequest.timeline ?? []), event],
    });
    await mirrorItemExchangeStatus(exchangeRequest.order_id, exchangeRequest.order_item_id, nextStatus);
  },
};
