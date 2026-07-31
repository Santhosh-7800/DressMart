import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, updateDoc, where, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, OrderItem, ReturnRequest, ReturnStatus } from '@/types';
import { RETURN_STATUS_LABELS } from '@/lib/returnStatus';

const RETURNS_COLLECTION = 'returns';
const ORDERS_COLLECTION = 'orders';

function toReturn(snap: { id: string; data: () => Record<string, unknown> }): ReturnRequest {
  return { id: snap.id, ...snap.data() } as ReturnRequest;
}

/** OrderItem.return_status is a narrower enum than ReturnStatus (no pickup_scheduled/received —
 *  those are folded into 'approved' for the item-level summary shown on order pages). */
function toOrderItemReturnStatus(status: ReturnStatus): OrderItem['return_status'] {
  switch (status) {
    case 'requested':
      return 'requested';
    case 'approved':
    case 'pickup_scheduled':
    case 'received':
      return 'approved';
    case 'refunded':
      return 'refunded';
    case 'rejected':
      return 'rejected';
  }
}

/** Return status lives twice: on the request doc, and mirrored onto the owning order item
 *  (order.items[].return_status) so OrderCard/OrderDetailsPage can show it without a second read.
 *  order.items is a plain array field, so Firestore requires rewriting the whole array. */
async function mirrorItemReturnStatus(orderId: string, orderItemId: string, status: ReturnStatus): Promise<void> {
  const orderSnap = await getDoc(doc(db, ORDERS_COLLECTION, orderId));
  if (!orderSnap.exists()) return;
  const order = orderSnap.data() as Order;
  const items = order.items.map((item) => (item.id === orderItemId ? { ...item, return_status: toOrderItemReturnStatus(status) } : item));
  await updateDoc(doc(db, ORDERS_COLLECTION, orderId), { items });
}

export const returnService = {
  async listForBuyer(buyerId: string): Promise<ReturnRequest[]> {
    const snap = await getDocs(query(collection(db, RETURNS_COLLECTION), where('buyer_id', '==', buyerId), orderBy('created_at', 'desc')));
    return snap.docs.map(toReturn);
  },

  /** Head Seller sees every return platform-wide (per firestore.rules); a regular seller only their own. */
  async listForSeller(sellerId: string, isHeadSeller: boolean): Promise<ReturnRequest[]> {
    const q = isHeadSeller
      ? query(collection(db, RETURNS_COLLECTION), orderBy('created_at', 'desc'))
      : query(collection(db, RETURNS_COLLECTION), where('seller_id', '==', sellerId), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(toReturn);
  },

  /** Realtime — buyer's own return requests update live as a seller approves/rejects/advances them. */
  subscribeForBuyer(buyerId: string, callback: (returns: ReturnRequest[]) => void): Unsubscribe {
    const q = query(collection(db, RETURNS_COLLECTION), where('buyer_id', '==', buyerId), orderBy('created_at', 'desc'));
    return onSnapshot(q, (snap) => callback(snap.docs.map(toReturn)));
  },

  /** Realtime — seller's own return queue (or, for Head Seller, every return) updates live as buyers submit requests. */
  subscribeForSeller(sellerId: string, isHeadSeller: boolean, callback: (returns: ReturnRequest[]) => void): Unsubscribe {
    const q = isHeadSeller
      ? query(collection(db, RETURNS_COLLECTION), orderBy('created_at', 'desc'))
      : query(collection(db, RETURNS_COLLECTION), where('seller_id', '==', sellerId), orderBy('created_at', 'desc'));
    return onSnapshot(q, (snap) => callback(snap.docs.map(toReturn)));
  },

  async request(buyerId: string, order: Order, orderItemId: string, reason: string, comment: string): Promise<ReturnRequest> {
    const item = order.items.find((i) => i.id === orderItemId);
    if (!item) throw new Error('Order item not found.');

    const now = new Date().toISOString();
    const payload = {
      order_id: order.id,
      order_item_id: orderItemId,
      buyer_id: buyerId,
      seller_id: item.seller_id,
      reason,
      comment: comment || null,
      status: 'requested' as ReturnStatus,
      refund_amount: item.total_price,
      timeline: [{ status: 'requested' as ReturnStatus, label: RETURN_STATUS_LABELS.requested, timestamp: now }],
      created_at: now,
    };
    const ref = await addDoc(collection(db, RETURNS_COLLECTION), payload);
    await mirrorItemReturnStatus(order.id, orderItemId, 'requested');
    return { id: ref.id, ...payload };
  },

  /** Seller/head-seller fulfillment action (plain updateDoc — rules already allow the owning seller_id / head_seller to write). */
  async advanceStatus(returnRequest: ReturnRequest, nextStatus: ReturnStatus): Promise<void> {
    const event = { status: nextStatus, label: RETURN_STATUS_LABELS[nextStatus], timestamp: new Date().toISOString() };
    await updateDoc(doc(db, RETURNS_COLLECTION, returnRequest.id), {
      status: nextStatus,
      timeline: [...(returnRequest.timeline ?? []), event],
    });
    await mirrorItemReturnStatus(returnRequest.order_id, returnRequest.order_item_id, nextStatus);
  },
};
