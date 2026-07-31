const GUEST_ID_KEY = 'dressmart:guest-id';

/** Stable per-browser id so cart/wishlist work before the user signs in. */
export function getGuestId(): string {
  if (typeof window === 'undefined') return 'guest';
  let id = window.localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = `guest-${crypto.randomUUID()}`;
    window.localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}
