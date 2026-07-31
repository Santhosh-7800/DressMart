import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { db } from '../lib/admin';
import { createNotification } from '../lib/notifications';
import type { Order, ReturnRequest, ReturnStatus } from '../lib/types';

const STATUS_LABEL: Record<ReturnStatus, string> = {
  requested: 'submitted',
  approved: 'approved',
  rejected: 'rejected',
  pickup_scheduled: 'scheduled for pickup',
  received: 'received back at the warehouse',
  refunded: 'refunded',
};

export const onReturnStatusChange = onDocumentUpdated('returns/{returnId}', async (event) => {
  const before = event.data?.before.data() as ReturnRequest | undefined;
  const after = event.data?.after.data() as ReturnRequest | undefined;
  if (!before || !after || before.status === after.status) return;

  await createNotification({
    userId: after.buyer_id,
    title: 'Return update',
    message: `Your return request has been ${STATUS_LABEL[after.status]}.`,
    type: 'return',
    link: `/orders/${after.order_id}`,
  });

  // Mirror the new status onto the matching order_item inside the parent order doc — Firestore
  // can't patch a single array element directly, so read -> map -> write back the whole array.
  const orderRef = db.collection('orders').doc(after.order_id);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) return;
  const order = orderSnap.data() as Order;
  let changed = false;
  const items = order.items.map((item) => {
    if (item.id !== after.order_item_id) return item;
    changed = true;
    return { ...item, return_status: after.status };
  });
  if (changed) {
    await orderRef.update({ items });
  }
});
