import type { Profile, UserRole } from '@/types';

/** The Head Seller is also a Seller — every seller-facing route/query must admit both. */
export const SELLER_ROLES: UserRole[] = ['seller', 'head_seller'];
export const HEAD_SELLER_ROLE: UserRole = 'head_seller';
export const STAFF_ROLE: UserRole = 'staff';

export function isSellerRole(role: UserRole | undefined): boolean {
  return Boolean(role) && SELLER_ROLES.includes(role as UserRole);
}

export function isHeadSeller(role: UserRole | undefined): boolean {
  return role === HEAD_SELLER_ROLE;
}

export function isStaffRole(role: UserRole | undefined): boolean {
  return role === STAFF_ROLE;
}

/**
 * The seller_id every product/order/inventory/return query for the signed-in user should scope
 * to. For a seller/head-seller this is just their own uid; for staff it's the Head Seller's uid
 * they were created under (Profile.seller_id) — staff never own anything under their own uid.
 */
export function effectiveSellerId(user: Pick<Profile, 'id' | 'role' | 'seller_id'> | null | undefined): string {
  if (!user) return '';
  return isStaffRole(user.role) ? user.seller_id ?? '' : user.id;
}

/** Where a signed-in user should land right after authenticating, based on role. */
export function getPostLoginRedirect(role: UserRole | undefined, fallback: string): string {
  if (isStaffRole(role)) return '/staff/dashboard';
  if (isSellerRole(role)) return '/seller/dashboard';
  return fallback;
}
