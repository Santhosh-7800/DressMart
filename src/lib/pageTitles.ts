/**
 * Static route → title lookup for the mobile "← Back  Title" header (see Header.tsx).
 *
 * Split deliberately follows what the screen is FOR, not just "is it the home page": browsing/
 * discovery surfaces (Home, Categories, Search, category listings, Deals/Flash Sales/New Arrivals/
 * Best Sellers) keep the full search-first app-bar since search is a natural companion action while
 * browsing — same reason Amazon/Flipkart keep search visible on category and results screens.
 * Everything else — account pages, cart/checkout, order/product detail, static/info pages — is a
 * screen you've drilled INTO, where the native pattern is a plain back arrow + title instead.
 */
const HOME_STYLE_EXACT = new Set(['/', '/categories', '/search', '/men', '/kids', '/deals', '/flash-sales', '/new-arrivals', '/best-sellers']);
const HOME_STYLE_PREFIXES = ['/men/', '/kids/'];

const EXACT_TITLES: Record<string, string> = {
  '/cart': 'Cart',
  '/checkout': 'Checkout',
  '/checkout/payment': 'Payment',
  '/track-order': 'Track Order',
  '/sell': 'Become a Seller',
  '/wishlist': 'Wishlist',
  '/orders': 'My Orders',
  '/addresses': 'Addresses',
  '/notifications': 'Notifications',
  '/coupons': 'Coupons',
  '/payments': 'Payment Methods',
  '/settings': 'Settings',
  '/profile': 'My Profile',
  '/help-center': 'Help Center',
  '/privacy-policy': 'Privacy Policy',
  '/terms': 'Terms & Conditions',
};

const PREFIX_TITLES: [prefix: string, title: string][] = [
  ['/product/', 'Product Details'],
  ['/orders/', 'Order Details'],
];

/** Returns null for routes that should keep the full home-style search app-bar — the caller uses
 *  that to decide which header variant to render. */
export function getMobilePageTitle(pathname: string): string | null {
  if (HOME_STYLE_EXACT.has(pathname) || HOME_STYLE_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  if (pathname in EXACT_TITLES) return EXACT_TITLES[pathname];
  for (const [prefix, title] of PREFIX_TITLES) {
    if (pathname.startsWith(prefix)) return title;
  }
  return 'DressMart';
}
