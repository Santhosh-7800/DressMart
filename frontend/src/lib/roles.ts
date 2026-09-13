import type { Profile, UserRole } from '@/types';

export const ADMIN_ROLE: UserRole = 'admin';
export const STAFF_ROLE: UserRole = 'staff';
export const DELIVERY_ROLE: UserRole = 'delivery';

export function isAdminRole(role: UserRole | undefined): boolean {
  return role === ADMIN_ROLE;
}

export function isStaffRole(role: UserRole | undefined): boolean {
  return role === STAFF_ROLE;
}

export function isDeliveryRole(role: UserRole | undefined): boolean {
  return role === DELIVERY_ROLE;
}

/**
 * The seller_id every product/order/inventory/return query for the signed-in user should scope
 * to. For the Admin this is just their own uid; for staff it's the Admin's uid they were created
 * under (Profile.seller_id) — staff never own anything under their own uid.
 */
export function effectiveSellerId(user: Pick<Profile, 'id' | 'role' | 'seller_id'> | null | undefined): string {
  if (!user) return '';
  return isStaffRole(user.role) ? user.seller_id ?? '' : user.id;
}

/** Where a signed-in user should land right after authenticating, based on role. */
export function getPostLoginRedirect(role: UserRole | undefined, fallback: string): string {
  if (isStaffRole(role)) return '/staff/dashboard';
  if (isDeliveryRole(role)) return '/delivery/dashboard';
  if (isAdminRole(role)) return '/admin/dashboard';
  return fallback;
}
