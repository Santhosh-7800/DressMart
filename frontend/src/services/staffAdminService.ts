import { collection, doc, getDoc, getDocs, orderBy, query, updateDoc, where, limit as fsLimit } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import type { Profile, StaffActivity, StaffPermissionKey, StaffPermissions, StaffProfile, StaffStatus } from '@/types';
import { authService } from './authService';

/**
 * Head-Seller-only reads/actions over their own staff roster. Mirrors sellerAdminService.ts's
 * split: account lifecycle (create/remove/reset-password — anything touching Firebase Auth) goes
 * through Cloud Functions so it can't drift out of sync; simple single-document edits (toggling a
 * permission, disabling an account, updating a designation) are plain Firestore writes, allowed
 * directly by firestore.rules for isHeadSeller().
 */
export const staffAdminService = {
  /** Every staff account belonging to this store (users where role == 'staff' && seller_id == sellerId). */
  async listStaff(sellerId: string): Promise<Profile[]> {
    const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'staff'), where('seller_id', '==', sellerId)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Profile);
  },

  async getStaffProfile(staffId: string): Promise<StaffProfile | null> {
    const snap = await getDoc(doc(db, 'staff', staffId));
    return snap.exists() ? ({ id: staffId, ...snap.data() } as StaffProfile) : null;
  },

  async getStaffPermissions(staffId: string): Promise<StaffPermissions | null> {
    const snap = await getDoc(doc(db, 'staff_permissions', staffId));
    return snap.exists() ? (snap.data() as StaffPermissions) : null;
  },

  /** Overwrites every permission key at once — the Permissions matrix always submits the full set. */
  async updateStaffPermissions(staffId: string, permissions: Record<StaffPermissionKey, boolean>): Promise<void> {
    await updateDoc(doc(db, 'staff_permissions', staffId), { ...permissions, updated_at: new Date().toISOString() });
  },

  async updateStaffProfile(staffId: string, updates: Partial<Pick<StaffProfile, 'designation' | 'department' | 'employee_id'>>): Promise<void> {
    await updateDoc(doc(db, 'staff', staffId), { ...updates, updated_at: new Date().toISOString() });
  },

  /** Disables (or re-enables) a staff account — blocks dashboard access without deleting anything,
   *  same spirit as suspendSellerAccount but without the cross-document product-deactivation
   *  fan-out (staff don't own products under their own uid, so there's nothing to deactivate). */
  async setStaffStatus(staffId: string, status: StaffStatus, reason: string | null): Promise<void> {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'users', staffId), { staff_status: status, staff_status_reason: status === 'disabled' ? reason : null, updated_at: now });
    await updateDoc(doc(db, 'staff', staffId), { status, status_reason: status === 'disabled' ? reason : null, updated_at: now });
  },

  /** Creates a brand-new, already-active staff account, then emails them Firebase's standard
   *  "set your password" link — no one, including the Head Seller, ever sets/knows their password. */
  async addStaff(input: {
    fullName: string;
    email: string;
    phone?: string;
    designation: string;
    employeeId?: string;
    department?: string;
    permissions: Record<StaffPermissionKey, boolean>;
  }): Promise<void> {
    const call = httpsCallable<typeof input, { success: true; uid: string }>(functions, 'addStaff');
    await call(input);
    await authService.requestPasswordReset(input.email);
  },

  /** Re-sends the password-reset email to an existing staff member. */
  async resetStaffPassword(staffId: string): Promise<void> {
    const call = httpsCallable<{ staffId: string }, { email: string }>(functions, 'resetStaffPassword');
    const { data } = await call({ staffId });
    await authService.requestPasswordReset(data.email);
  },

  /** Permanently deletes a staff member's Auth account and profile docs. */
  async removeStaff(staffId: string): Promise<void> {
    const call = httpsCallable<{ staffId: string }, { success: true }>(functions, 'removeStaff');
    await call({ staffId });
  },

  /** Most recent activity across the whole staff roster — Add/Edit/Delete product actions plus logins. */
  async listStaffActivity(sellerId: string, maxDocs = 50): Promise<StaffActivity[]> {
    const snap = await getDocs(
      query(collection(db, 'staff_activity'), where('seller_id', '==', sellerId), orderBy('created_at', 'desc'), fsLimit(maxDocs)),
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StaffActivity);
  },
};
