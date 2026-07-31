import { collection, addDoc, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { productService } from '@/services/productService';
import type { WishlistItem } from '@/types';

const WISHLIST_COLLECTION = 'wishlist';
const GUEST_WISHLIST_KEY = 'dressmart:guest-wishlist';

interface GuestWishlistEntry {
  product_id: string;
  created_at: string;
}

function readGuestEntries(): GuestWishlistEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(GUEST_WISHLIST_KEY);
    return raw ? (JSON.parse(raw) as GuestWishlistEntry[]) : [];
  } catch {
    return [];
  }
}

function writeGuestEntries(entries: GuestWishlistEntry[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(entries));
  // Same cross-tab/component notification useLocalStorage's setter relies on — anything reading
  // this key via useLocalStorage(GUEST_WISHLIST_KEY, ...) picks up the change immediately.
  window.dispatchEvent(new StorageEvent('storage', { key: GUEST_WISHLIST_KEY }));
}

/** Attaches `product` to every item, dropping any whose product no longer exists/is inactive. */
async function hydrate(items: Omit<WishlistItem, 'product'>[]): Promise<WishlistItem[]> {
  if (items.length === 0) return [];
  const productIds = [...new Set(items.map((i) => i.product_id))];
  const products = await productService.getByIds(productIds);
  const byId = new Map(products.map((p) => [p.id, p]));
  return items.map((item) => ({ ...item, product: byId.get(item.product_id) })).filter((i) => i.product);
}

export const wishlistService = {
  /** Signed-in wishlist, read from Firestore. */
  async list(userId: string): Promise<WishlistItem[]> {
    const snap = await getDocs(query(collection(db, WISHLIST_COLLECTION), where('user_id', '==', userId)));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Omit<WishlistItem, 'product'>);
    return hydrate(items);
  },

  /** Adds if not already wishlisted, removes if it is. Firestore's wishlist rule has no `update`,
   *  only create/delete, so toggling is always one of those two — never a field update. */
  async toggle(userId: string, productId: string): Promise<{ items: WishlistItem[]; added: boolean }> {
    const existing = await getDocs(
      query(collection(db, WISHLIST_COLLECTION), where('user_id', '==', userId), where('product_id', '==', productId)),
    );
    if (!existing.empty) {
      await Promise.all(existing.docs.map((d) => deleteDoc(d.ref)));
      return { items: await this.list(userId), added: false };
    }
    await addDoc(collection(db, WISHLIST_COLLECTION), { user_id: userId, product_id: productId, created_at: new Date().toISOString() });
    return { items: await this.list(userId), added: true };
  },

  async remove(userId: string, wishlistItemId: string): Promise<WishlistItem[]> {
    await deleteDoc(doc(db, WISHLIST_COLLECTION, wishlistItemId));
    return this.list(userId);
  },

  // --- Guest (pre-login) wishlist — pure localStorage, no Firestore doc (wishlist rules require
  // a signed-in owner). Kept under a stable per-browser key so it survives across tabs/reloads and
  // can be merged into the account the moment the guest signs in. ---

  async listGuest(): Promise<WishlistItem[]> {
    // Guest entries have no Firestore doc, so synthesize a stable `id`/`user_id` from the product
    // id — good enough for React keys and for remove-by-id to work the same way as the signed-in path.
    const items = readGuestEntries().map((e) => ({ id: `guest:${e.product_id}`, user_id: 'guest', product_id: e.product_id, created_at: e.created_at }));
    return hydrate(items);
  },

  toggleGuest(productId: string): { added: boolean } {
    const entries = readGuestEntries();
    const idx = entries.findIndex((e) => e.product_id === productId);
    if (idx >= 0) {
      entries.splice(idx, 1);
      writeGuestEntries(entries);
      return { added: false };
    }
    entries.push({ product_id: productId, created_at: new Date().toISOString() });
    writeGuestEntries(entries);
    return { added: true };
  },

  /** Accepts either a raw product id or the synthesized `guest:{productId}` wishlist item id. */
  removeGuest(idOrProductId: string): void {
    const productId = idOrProductId.startsWith('guest:') ? idOrProductId.slice('guest:'.length) : idOrProductId;
    writeGuestEntries(readGuestEntries().filter((e) => e.product_id !== productId));
  },

  /**
   * Folds the guest's localStorage wishlist into their now-signed-in Firestore wishlist, then
   * clears local storage. Each product is added only if it isn't already wishlisted on the account,
   * so calling this more than once (e.g. two mounted components both noticing the same login) is safe.
   */
  async mergeGuestIntoAccount(userId: string): Promise<void> {
    const guestEntries = readGuestEntries();
    if (guestEntries.length === 0) return;

    const existing = await getDocs(query(collection(db, WISHLIST_COLLECTION), where('user_id', '==', userId)));
    const existingProductIds = new Set(existing.docs.map((d) => d.data().product_id as string));

    await Promise.all(
      guestEntries
        .filter((entry) => !existingProductIds.has(entry.product_id))
        .map((entry) =>
          addDoc(collection(db, WISHLIST_COLLECTION), {
            user_id: userId,
            product_id: entry.product_id,
            created_at: entry.created_at,
          }),
        ),
    );

    writeGuestEntries([]);
  },
};

export { GUEST_WISHLIST_KEY };
