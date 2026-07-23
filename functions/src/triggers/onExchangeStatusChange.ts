import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { db } from '../lib/admin';
import { createNotification } from '../lib/notifications';
import type { ExchangeRequest, ExchangeStatus, Order } from '../lib/types';

const STATUS_LABEL: Record<ExchangeStatus, string> = {
  requested: 'submitted',
  approved: 'approved',
  rejected: 'rejected',
  pickup_scheduled: 'scheduled for pickup',
  exchanged: 'completed',
};

export const onExchangeStatusChange = onDocumentUpdated('exchanges/{exchangeId}', async (event) => {
  const before = event.data?.before.data() as ExchangeRequest | undefined;
  const after = event.data?.after.data() as ExchangeRequest | undefined;
  if (!before || !after || before.status === after.status) return;

  await createNotification({
    userId: after.buyer_id,
    title: 'Exchange update',
    message: `Your exchange request has been ${STATUS_LABEL[after.status]}.`,
    type: 'exchange',
    link: `/orders/${after.order_id}`,
  });

  const orderRef = db.collection('orders').doc(after.order_id);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) return;
  const order = orderSnap.data() as Order;
  let changed = false;
  const items = order.items.map((item) => {
    if (item.id !== after.order_item_id) return item;
    changed = true;
    return { ...item, exchange_status: after.status };
  });
  if (changed) {
    await orderRef.update({ items });
  }
});
