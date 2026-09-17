import type { Profile, UserRole } from '@/types';

export const BUYER_ROLE: UserRole = 'buyer';
export const ADMIN_ROLE: UserRole = 'admin';
export const STAFF_ROLE: UserRole = 'staff';

const KNOWN_ROLES: readonly UserRole[] = [BUYER_ROLE, ADMIN_ROLE, STAFF_ROLE];

/**
 * Firestore's `role` field is free-text (no schema enforcement), so a manual edit in the Firebase
 * Console — e.g. retyping "staff" and leaving a trailing space — produces a value that fails every
 * strict `=== 'staff'` check in this file, silently falling through to the buyer/no-role behavior
 * instead of erroring. Every place that reads a role off a Profile (loading it from Firestore,
 * comparing it in isAdminRole/isStaffRole, computing a redirect) must go through this first, so
 * whitespace or casing typed by a human can never break routing. Unrecognized values (typos, a role
 * that isn't one of the three canonical ones) resolve to `undefined` — treated as "no role
 * identified" by every isXRole check and by getPostLoginRedirect's fallback — rather than being
 * coerced into some guessed role. */
export function normalizeRole(role: unknown): UserRole | undefined {
  if (typeof role !== 'string') return undefined;
  const trimmed = role.trim().toLowerCase() as UserRole;
  return KNOWN_ROLES.includes(trimmed) ? trimmed : undefined;
}

export function isAdminRole(role: UserRole | undefined): boolean {
  return normalizeRole(role) === ADMIN_ROLE;
}

export function isStaffRole(role: UserRole | undefined): boolean {
  return normalizeRole(role) === STAFF_ROLE;
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
  if (isAdminRole(role)) return '/admin/dashboard';
  return fallback;
}
