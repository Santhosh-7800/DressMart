import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getGuestId } from '@/lib/guestId';
import type { CartItem, Inventory, Product } from '@/types';

const CART_COLLECTION = 'cart';

/** A cart line item with the owning product/variant hydrated, plus live stock merged in from the
 *  separate `inventory/{productId}` doc (see types/database.ts — stock is never on the product itself). */
export interface CartLineItem extends CartItem {
  /** Units currently in stock for this exact variant. 0 if the product/variant/inventory doc is missing. */
  availableStock: number;
}

function guestStorageKey(): string {
  return `dressmart:guest-cart:${getGuestId()}`;
}

function readGuestItems(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(guestStorageKey());
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function writeGuestItems(items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(guestStorageKey(), JSON.stringify(items));
}

function newGuestId(): string {
  return `guest-cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Merges live product + inventory data onto raw cart rows. Both `products` and `inventory` are
 *  publicly readable (see firestore.rules), so this works for guests too. */
async function hydrate(rawItems: CartItem[]): Promise<CartLineItem[]> {
  const productIds = [...new Set(rawItems.map((i) => i.product_id))];
  if (productIds.length === 0) return [];

  const [productSnaps, inventorySnaps] = await Promise.all([
    Promise.all(productIds.map((id) => getDoc(doc(db, 'products', id)))),
    Promise.all(productIds.map((id) => getDoc(doc(db, 'inventory', id)))),
  ]);

  const productMap = new Map<string, Product>();
  productSnaps.forEach((snap) => {
    if (snap.exists()) productMap.set(snap.id, { id: snap.id, ...snap.data() } as Product);
  });

  const inventoryMap = new Map<string, Inventory>();
  inventorySnaps.forEach((snap) => {
    if (snap.exists()) inventoryMap.set(snap.id, snap.data() as Inventory);
  });

  return rawItems.map((item) => {
    const product = productMap.get(item.product_id);
    const variant = product?.variants.find((v) => v.id === item.variant_id);
    const inventory = inventoryMap.get(item.product_id);
    const availableStock = inventory?.variant_stock?.[item.variant_id] ?? 0;
    return { ...item, product, variant, availableStock };
  });
}

async function fetchRaw(userId: string, savedForLater: boolean): Promise<CartItem[]> {
  const snap = await getDocs(
    query(collection(db, CART_COLLECTION), where('user_id', '==', userId), where('saved_for_later', '==', savedForLater)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CartItem);
}

export const cartService = {
  // ---- Signed-in (Firestore) ----

  async list(userId: string): Promise<CartLineItem[]> {
    return hydrate(await fetchRaw(userId, false));
  },

  async savedForLater(userId: string): Promise<CartLineItem[]> {
    return hydrate(await fetchRaw(userId, true));
  },

  async addItem(userId: string, productId: string, variantId: string, quantity = 1): Promise<CartLineItem[]> {
    const existing = await getDocs(
      query(
        collection(db, CART_COLLECTION),
        where('user_id', '==', userId),
        where('product_id', '==', productId),
        where('variant_id', '==', variantId),
        where('saved_for_later', '==', false),
      ),
    );
    if (!existing.empty) {
      const existingDoc = existing.docs[0];
      const currentQty = (existingDoc.data().quantity as number) ?? 0;
      await updateDoc(existingDoc.ref, { quantity: currentQty + quantity });
    } else {
      await addDoc(collection(db, CART_COLLECTION), {
        user_id: userId,
        product_id: productId,
        variant_id: variantId,
        quantity,
        saved_for_later: false,
        created_at: new Date().toISOString(),
      });
    }
    return this.list(userId);
  },

  async updateQuantity(userId: string, cartItemId: string, quantity: number): Promise<CartLineItem[]> {
    await updateDoc(doc(db, CART_COLLECTION, cartItemId), { quantity });
    return this.list(userId);
  },

  async removeItem(userId: string, cartItemId: string): Promise<CartLineItem[]> {
    await deleteDoc(doc(db, CART_COLLECTION, cartItemId));
    return this.list(userId);
  },

  async saveForLater(userId: string, cartItemId: string, saved: boolean): Promise<CartLineItem[]> {
    await updateDoc(doc(db, CART_COLLECTION, cartItemId), { saved_for_later: saved });
    return this.list(userId);
  },

  /** Clears only the active cart (not saved-for-later items) — called after a successful checkout. */
  async clear(userId: string): Promise<void> {
    const raw = await fetchRaw(userId, false);
    await Promise.all(raw.map((item) => deleteDoc(doc(db, CART_COLLECTION, item.id))));
  },

  // ---- Guest (localStorage) ----

  async listGuest(): Promise<CartLineItem[]> {
    return hydrate(readGuestItems().filter((i) => !i.saved_for_later));
  },

  async savedForLaterGuest(): Promise<CartLineItem[]> {
    return hydrate(readGuestItems().filter((i) => i.saved_for_later));
  },

  async addItemGuest(productId: string, variantId: string, quantity = 1): Promise<CartLineItem[]> {
    const items = readGuestItems();
    const existing = items.find((i) => i.product_id === productId && i.variant_id === variantId && !i.saved_for_later);
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({
        id: newGuestId(),
        user_id: getGuestId(),
        product_id: productId,
        variant_id: variantId,
        quantity,
        saved_for_later: false,
        created_at: new Date().toISOString(),
      });
    }
    writeGuestItems(items);
    return this.listGuest();
  },

  async updateQuantityGuest(cartItemId: string, quantity: number): Promise<CartLineItem[]> {
    writeGuestItems(readGuestItems().map((i) => (i.id === cartItemId ? { ...i, quantity } : i)));
    return this.listGuest();
  },

  async removeItemGuest(cartItemId: string): Promise<CartLineItem[]> {
    writeGuestItems(readGuestItems().filter((i) => i.id !== cartItemId));
    return this.listGuest();
  },

  async saveForLaterGuest(cartItemId: string, saved: boolean): Promise<CartLineItem[]> {
    writeGuestItems(readGuestItems().map((i) => (i.id === cartItemId ? { ...i, saved_for_later: saved } : i)));
    return this.listGuest();
  },

  async clearGuest(): Promise<void> {
    writeGuestItems(readGuestItems().filter((i) => i.saved_for_later));
  },

  /**
   * One-time merge of the guest (localStorage) cart into the signed-in user's Firestore cart —
   * called right after login/signup. Matching product+variant+saved_for_later rows have their
   * quantities summed; everything else is inserted as a new doc. Returns true if anything was merged.
   */
  async mergeGuestCartIntoAccount(userId: string): Promise<boolean> {
    const guestItems = readGuestItems();
    if (guestItems.length === 0) return false;

    const existingSnap = await getDocs(query(collection(db, CART_COLLECTION), where('user_id', '==', userId)));
    const existingByKey = new Map(existingSnap.docs.map((d) => [`${d.data().product_id}:${d.data().variant_id}:${d.data().saved_for_later}`, d]));

    for (const item of guestItems) {
      const key = `${item.product_id}:${item.variant_id}:${item.saved_for_later}`;
      const match = existingByKey.get(key);
      if (match) {
        const currentQty = (match.data().quantity as number) ?? 0;
        await updateDoc(match.ref, { quantity: currentQty + item.quantity });
      } else {
        await addDoc(collection(db, CART_COLLECTION), {
          user_id: userId,
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          saved_for_later: item.saved_for_later,
          created_at: item.created_at ?? new Date().toISOString(),
        });
      }
    }

    writeGuestItems([]);
    return true;
  },
};
