import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { createNotification } from '../lib/notifications';
import type { Order, OrderStatus } from '../lib/types';

const STATUS_COPY: Partial<
  Record<OrderStatus, { title: string; message: (order: Order) => string; type: 'order' | 'delivery' }>
> = {
  confirmed: {
    title: 'Order confirmed',
    message: (o) => `Your order ${o.order_number} has been confirmed.`,
    type: 'order',
  },
  packed: {
    title: 'Order packed',
    message: (o) => `Your order ${o.order_number} has been packed and will ship soon.`,
    type: 'order',
  },
  shipped: {
    title: 'Order shipped',
    message: (o) => `Your order ${o.order_number} is on its way.`,
    type: 'delivery',
  },
  out_for_delivery: {
    title: 'Out for delivery',
    message: (o) => `Your order ${o.order_number} is out for delivery today.`,
    type: 'delivery',
  },
  delivered: {
    title: 'Order delivered',
    message: (o) => `Your order ${o.order_number} has been delivered. Enjoy!`,
    type: 'delivery',
  },
  returned: {
    title: 'Order returned',
    message: (o) => `Your order ${o.order_number} has been marked as returned.`,
    type: 'delivery',
  },
};

/**
 * Fires whenever a seller/head-seller advances `orders/{orderId}.status` via a plain client write
 * (per firestore.rules). 'cancelled' is deliberately skipped here — the `cancelOrder` callable
 * already sends both the buyer and seller a dedicated notification for that transition, so
 * reacting to it again here would double-notify the buyer.
 */
export const onOrderStatusChange = onDocumentUpdated('orders/{orderId}', async (event) => {
  const before = event.data?.before.data() as Order | undefined;
  const after = event.data?.after.data() as Order | undefined;
  if (!before || !after || before.status === after.status) return;
  if (after.status === 'cancelled') return;

  const copy = STATUS_COPY[after.status];
  if (!copy) return;

  await createNotification({
    userId: after.buyer_id,
    title: copy.title,
    message: copy.message(after),
    type: copy.type,
    link: `/orders/${event.params.orderId}`,
  });
});
