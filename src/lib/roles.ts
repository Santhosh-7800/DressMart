import type { UserRole } from '@/types';

/** The Head Seller is also a Seller — every seller-facing route/query must admit both. */
export const SELLER_ROLES: UserRole[] = ['seller', 'head_seller'];
export const HEAD_SELLER_ROLE: UserRole = 'head_seller';

export function isSellerRole(role: UserRole | undefined): boolean {
  return Boolean(role) && SELLER_ROLES.includes(role as UserRole);
}

export function isHeadSeller(role: UserRole | undefined): boolean {
  return role === HEAD_SELLER_ROLE;
}

/** Where a signed-in user should land right after authenticating, based on role. */
export function getPostLoginRedirect(role: UserRole | undefined, fallback: string): string {
  if (isSellerRole(role)) return '/seller/dashboard';
  return fallback;
}
