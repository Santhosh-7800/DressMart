import type { UserRole } from '@/types';

/** admin and shop_owner have identical backend powers throughout the admin panel. */
export const BACKEND_ROLES: UserRole[] = ['admin', 'shop_owner'];
/** The Staff Portal (/staff/*) is for role='staff' only — admin/shop_owner are deliberately
 *  excluded, they have their own separate panel and must never see the Staff Dashboard. */
export const STAFF_ONLY_ROLE: UserRole[] = ['staff'];

export function isBackendRole(role: UserRole | undefined): boolean {
  return Boolean(role) && BACKEND_ROLES.includes(role as UserRole);
}

/** Where a signed-in user should land right after authenticating, based on role. */
export function getPostLoginRedirect(role: UserRole | undefined, fallback: string): string {
  if (isBackendRole(role)) return '/admin';
  if (role === 'staff') return '/staff/dashboard';
  return fallback;
}
