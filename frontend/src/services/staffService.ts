import { addDoc, collection, doc, getDoc, getDocs, limit as fsLimit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { StaffActivity, StaffActivityAction, StaffPermissions } from '@/types';

/** Staff-facing reads plus the one shared write (logActivity) called from anywhere a staff-gated
 *  action succeeds — see useSellerProducts.ts's create/update/delete mutations. */
export const staffService = {
  async getOwnPermissions(staffId: string): Promise<StaffPermissions | null> {
    const snap = await getDoc(doc(db, 'staff_permissions', staffId));
    return snap.exists() ? (snap.data() as StaffPermissions) : null;
  },

  /** Appends one entry to the append-only staff_activity log. firestore.rules require
   *  `staff_id == uid()` on create, so this can only ever log the caller's own action. */
  async logActivity(entry: {
    sellerId: string;
    staffId: string;
    staffName: string;
    action: StaffActivityAction;
    targetType?: StaffActivity['target_type'];
    targetId?: string | null;
    targetLabel?: string | null;
  }): Promise<void> {
    await addDoc(collection(db, 'staff_activity'), {
      seller_id: entry.sellerId,
      staff_id: entry.staffId,
      staff_name: entry.staffName,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      target_label: entry.targetLabel ?? null,
      created_at: new Date().toISOString(),
    });
  },

  async listOwnActivity(staffId: string, maxDocs = 20): Promise<StaffActivity[]> {
    const snap = await getDocs(
      query(collection(db, 'staff_activity'), where('staff_id', '==', staffId), orderBy('created_at', 'desc'), fsLimit(maxDocs)),
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StaffActivity);
  },
};
