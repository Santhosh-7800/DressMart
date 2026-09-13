import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import type { DeliveryStaffProfile, DeliveryStaffStatus, Profile } from '@/types';
import { authService } from './authService';

/**
 * Head-Seller-only reads/actions over the delivery-personnel roster. Mirrors staffAdminService.ts's
 * split exactly: account lifecycle (create/remove/reset-password — anything touching Firebase Auth)
 * goes through Cloud Functions; simple single-document edits (activate/deactivate) are plain
 * Firestore writes, allowed directly by firestore.rules for isAdmin().
 */
export const deliveryAdminService = {
  /** Every delivery account (users where role == 'delivery') — platform-wide, since delivery is a
   *  Head-Seller-managed resource, not scoped per individual seller. */
  async listDeliveryStaff(): Promise<Profile[]> {
    const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'delivery')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Profile);
  },

  async getDeliveryProfile(deliveryStaffId: string): Promise<DeliveryStaffProfile | null> {
    const snap = await getDoc(doc(db, 'delivery_staff', deliveryStaffId));
    return snap.exists() ? ({ id: deliveryStaffId, ...snap.data() } as DeliveryStaffProfile) : null;
  },

  /** Disables (or re-enables) a delivery account — blocks new assignment without deleting anything
   *  or touching any order already assigned to them (see assignDelivery.ts's active-status check).
   *  Dual-writes both docs, mirroring staffAdminService.setStaffStatus exactly: delivery_staff/{uid}
   *  is what Cloud Functions check server-side, users/{uid} is what the roster list displays. */
  async setDeliveryStaffStatus(deliveryStaffId: string, status: DeliveryStaffStatus, reason: string | null): Promise<void> {
    const now = new Date().toISOString();
    const statusReason = status === 'inactive' ? reason : null;
    await updateDoc(doc(db, 'users', deliveryStaffId), { delivery_staff_status: status, delivery_staff_status_reason: statusReason, updated_at: now });
    await updateDoc(doc(db, 'delivery_staff', deliveryStaffId), { status, status_reason: statusReason, updated_at: now });
  },

  /** Creates a brand-new, already-active delivery account, then emails them Firebase's standard
   *  "set your password" link — no one, including the Head Seller, ever sets/knows their password. */
  async addDeliveryStaff(input: { fullName: string; email: string; phone: string }): Promise<void> {
    const call = httpsCallable<typeof input, { success: true; uid: string }>(functions, 'addDeliveryStaff');
    await call(input);
    await authService.requestPasswordReset(input.email);
  },

  /** Re-sends the password-reset email to an existing delivery account. */
  async resetDeliveryStaffPassword(deliveryStaffId: string): Promise<void> {
    const call = httpsCallable<{ deliveryStaffId: string }, { email: string }>(functions, 'resetDeliveryStaffPassword');
    const { data } = await call({ deliveryStaffId });
    await authService.requestPasswordReset(data.email);
  },

  /** Permanently deletes a delivery account — blocked server-side while an active delivery is
   *  in progress for them (deactivate instead in that case). */
  async removeDeliveryStaff(deliveryStaffId: string): Promise<void> {
    const call = httpsCallable<{ deliveryStaffId: string }, { success: true }>(functions, 'removeDeliveryStaff');
    await call({ deliveryStaffId });
  },

  /** Assigns (or reassigns) an order to a delivery person — one Cloud Function handles both, see
   *  assignDelivery.ts. */
  async assignDelivery(orderId: string, deliveryStaffId: string): Promise<void> {
    const call = httpsCallable<{ orderId: string; deliveryStaffId: string }, { success: true }>(functions, 'assignDelivery');
    await call({ orderId, deliveryStaffId });
  },
};
