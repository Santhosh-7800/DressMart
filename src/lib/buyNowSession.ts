/**
 * "Buy Now" checkout bypass — a single item goes straight to checkout without ever touching the
 * persistent cart, exactly like the spec's "Create temporary checkout -> ... -> Clear Temporary
 * Checkout" flow. Implemented as a tab-scoped sessionStorage entry rather than a Firestore
 * document: a Buy Now purchase is an immediate, single-session action (no cross-device resume
 * needed), so a Firestore doc would only add write/cleanup/security-rule overhead for no real
 * benefit — sessionStorage already gives "gone if the tab closes without finishing," which is
 * exactly the right lifetime for a temporary checkout.
 */
const KEY = 'dressmart:buy-now-item';

export interface BuyNowItem {
  productId: string;
  variantId: string;
  quantity: number;
}

export function setBuyNowItem(item: BuyNowItem): void {
  sessionStorage.setItem(KEY, JSON.stringify(item));
}

export function getBuyNowItem(): BuyNowItem | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BuyNowItem) : null;
  } catch {
    return null;
  }
}

export function clearBuyNowItem(): void {
  sessionStorage.removeItem(KEY);
}
