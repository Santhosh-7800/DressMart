import { randomUUID } from 'node:crypto';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { auth, db } from '../lib/admin';
import type { Profile, StaffPermissionKey } from '../lib/types';

interface AddStaffData {
  fullName: string;
  email: string;
  phone?: string;
  designation: string;
  employeeId?: string;
  department?: string;
  permissions?: Partial<Record<StaffPermissionKey, boolean>>;
}

const PERMISSION_KEYS: StaffPermissionKey[] = [
  'add_products',
  'edit_products',
  'delete_products',
  'manage_inventory',
  'upload_images',
  'process_orders',
  'update_order_status',
  'approve_returns',
  'reply_to_customers',
  'view_reports',
];

/**
 * Head-Seller-only: creates a brand-new staff account under the caller's own store. Mirrors
 * addSeller.ts's account-creation pattern exactly (random throwaway password, client follows up
 * with authService.requestPasswordReset) — no one, including the Head Seller, ever sets or knows
 * another user's actual password. Writes three docs atomically-enough for this use case: the
 * auth-linked `users/{uid}` profile (role/staff_status — what login/route-gating needs), the
 * extended `staff/{uid}` profile (designation/department/etc — display-only), and
 * `staff_permissions/{uid}` (what firestore.rules and the Staff Dashboard nav actually gate on).
 */
export const addStaff = onCall<AddStaffData>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const { fullName, email, phone, designation, employeeId, department, permissions } = request.data ?? ({} as AddStaffData);
  if (!fullName?.trim() || !email?.trim() || !designation?.trim()) {
    throw new HttpsError('invalid-argument', 'fullName, email, and designation are required.');
  }

  const callerSnap = await db.collection('users').doc(request.auth.uid).get();
  const caller = callerSnap.data() as Profile | undefined;
  if (!caller || caller.role !== 'head_seller') {
    throw new HttpsError('permission-denied', 'Only the Head Seller can add staff.');
  }

  let userRecord;
  try {
    userRecord = await auth.createUser({
      email: email.trim(),
      password: randomUUID(),
      displayName: fullName.trim(),
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'A user with this email already exists.');
    }
    throw new HttpsError('internal', 'Could not create the staff account.');
  }

  const now = new Date().toISOString();
  const profile: Omit<Profile, 'id'> = {
    email: email.trim(),
    full_name: fullName.trim(),
    phone: phone?.trim() || null,
    avatar_url: null,
    role: 'staff',
    created_at: now,
    updated_at: now,
    store_name: caller.store_name,
    seller_id: request.auth.uid,
    staff_status: 'active',
    staff_status_reason: null,
  };
  await db.collection('users').doc(userRecord.uid).set(profile);

  await db.collection('staff').doc(userRecord.uid).set({
    seller_id: request.auth.uid,
    employee_id: employeeId?.trim() || null,
    designation: designation.trim(),
    department: department?.trim() || null,
    status: 'active',
    status_reason: null,
    created_by: request.auth.uid,
    created_at: now,
    updated_at: now,
  });

  const grantedPermissions = Object.fromEntries(PERMISSION_KEYS.map((key) => [key, Boolean(permissions?.[key])]));
  await db.collection('staff_permissions').doc(userRecord.uid).set({
    staff_id: userRecord.uid,
    ...grantedPermissions,
    updated_at: now,
  });

  return { success: true, uid: userRecord.uid };
});
