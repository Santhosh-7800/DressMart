import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

type DeliveryAction = 'accept' | 'picked_up' | 'out_for_delivery' | 'delivered' | 'failed' | 'note';

interface UpdateDeliveryStatusInput {
  orderId: string;
  action: DeliveryAction;
  reason?: string;
  note?: string;
}

/**
 * Delivery-staff-facing actions — every mutation goes through the single updateDeliveryStatus
 * Cloud Function (see its own docstring for why one function covers all of these), which validates
 * the caller is the order's own assigned delivery_staff_id and that the transition is legal.
 */
export const deliveryService = {
  async accept(orderId: string): Promise<void> {
    await callUpdateDeliveryStatus({ orderId, action: 'accept' });
  },
  async markPickedUp(orderId: string): Promise<void> {
    await callUpdateDeliveryStatus({ orderId, action: 'picked_up' });
  },
  async markOutForDelivery(orderId: string): Promise<void> {
    await callUpdateDeliveryStatus({ orderId, action: 'out_for_delivery' });
  },
  async markDelivered(orderId: string): Promise<void> {
    await callUpdateDeliveryStatus({ orderId, action: 'delivered' });
  },
  async markFailed(orderId: string, reason: string): Promise<void> {
    await callUpdateDeliveryStatus({ orderId, action: 'failed', reason });
  },
  async addNote(orderId: string, note: string): Promise<void> {
    await callUpdateDeliveryStatus({ orderId, action: 'note', note });
  },
};

async function callUpdateDeliveryStatus(input: UpdateDeliveryStatusInput): Promise<void> {
  const call = httpsCallable<UpdateDeliveryStatusInput, { success: true }>(functions, 'updateDeliveryStatus');
  await call(input);
}
