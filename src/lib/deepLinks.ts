/** Custom-window event name used to bridge a native `appUrlOpen` deep link (which fires outside
 *  the React tree) into React Router — see `DeepLinkListener` (mounted in AppRoutes.tsx) and
 *  `initCapacitorNative` (src/lib/capacitorNative.ts), which dispatches this event. */
export const DEEP_LINK_EVENT = 'dressmart:deeplink';

/**
 * Resolves a `dressmart://...` URL (or a plain https URL pointing at this app, for forward
 * compatibility with Android App Links later) into an in-app route path, or null if it doesn't
 * match anything routable — callers should ignore null rather than navigate anywhere.
 */
export function resolveDeepLinkPath(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  // `dressmart://product/red-shirt` → host="product", pathname="/red-shirt"
  // `https://dressmart.app/product/red-shirt` → host="dressmart.app", pathname="/product/red-shirt"
  const isCustomScheme = parsed.protocol === 'dressmart:';
  const segments = (isCustomScheme ? `${parsed.hostname}${parsed.pathname}` : parsed.pathname)
    .split('/')
    .filter(Boolean);

  const [kind, ...rest] = segments;
  switch (kind) {
    case 'product':
      return rest[0] ? `/product/${rest[0]}` : null;
    case 'orders':
      return rest[0] ? `/orders/${rest[0]}` : '/orders';
    case 'men':
      return rest[0] ? `/men/${rest[0]}` : '/men';
    case 'kids':
      return rest[0] ? `/kids/${rest[0]}` : '/kids';
    case 'cart':
      return '/cart';
    case 'wishlist':
      return '/wishlist';
    default:
      return null;
  }
}
