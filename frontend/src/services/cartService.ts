import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CartItem, Inventory, Product } from '@/types';

/** `users/{uid}/cart` — cart is signed-in-only (see Issue 2 requirements); there is no guest/localStorage cart. */
function cartCollection(userId: string) {
  return collection(db, 'users', userId, 'cart');
}

/** A cart line item with the owning product/variant hydrated, plus live stock merged in from the
 *  separate `inventory/{productId}` doc (see types/database.ts — stock is never on the product itself).
 *  `price`/`image`/`size`/`color` on the raw doc are the add-time snapshot; `product`/`variant` here
 *  are live, used for display accuracy (current price/name/thumbnail) and for stock validation. */
export interface CartLineItem extends CartItem {
  /** Units currently in stock for this exact variant. 0 if the product/variant/inventory doc is missing. */
  availableStock: number;
}

async function hydrate(rawItems: CartItem[]): Promise<CartLineItem[]> {
  const productIds = [...new Set(rawItems.map((i) => i.productId))];
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
    const product = productMap.get(item.productId);
    const variant = product?.variants.find((v) => v.id === item.variantId);
    const inventory = inventoryMap.get(item.productId);
    const availableStock = inventory?.variant_stock?.[item.variantId] ?? 0;
    return { ...item, product, variant, availableStock };
  });
}

async function fetchRaw(userId: string, savedForLater: boolean): Promise<CartItem[]> {
  const snap = await getDocs(query(cartCollection(userId), where('savedForLater', '==', savedForLater)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CartItem);
}

async function findExisting(userId: string, productId: string, variantId: string, savedForLater: boolean) {
  const snap = await getDocs(
    query(cartCollection(userId), where('productId', '==', productId), where('variantId', '==', variantId), where('savedForLater', '==', savedForLater)),
  );
  return snap.empty ? null : snap.docs[0];
}

export const cartService = {
  async list(userId: string): Promise<CartLineItem[]> {
    return hydrate(await fetchRaw(userId, false));
  },

  async savedForLater(userId: string): Promise<CartLineItem[]> {
    return hydrate(await fetchRaw(userId, true));
  },

  /** Realtime subscription — fires on any add/remove/quantity change from this tab, another tab, or
   *  another device, and re-hydrates (product + live stock) on every change. */
  subscribeToCart(userId: string, savedForLater: boolean, callback: (items: CartLineItem[]) => void): Unsubscribe {
    const q = query(cartCollection(userId), where('savedForLater', '==', savedForLater));
    return onSnapshot(q, (snap) => {
      const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CartItem);
      hydrate(raw).then(callback);
    });
  },

  /**
   * Validates and adds one variant to the cart, or increments quantity if it's already there.
   * Fetches the product fresh (needed anyway to snapshot seller/price/image/size/color at add-time,
   * and to validate the variant/color actually exists and has stock — never trust a stale caller).
   */
  async addItem(userId: string, productId: string, variantId: string, quantity = 1): Promise<CartLineItem[]> {
    const [productSnap, inventorySnap] = await Promise.all([getDoc(doc(db, 'products', productId)), getDoc(doc(db, 'inventory', productId))]);
    if (!productSnap.exists()) throw new Error('This product is no longer available.');
    const product = { id: productSnap.id, ...productSnap.data() } as Product;

    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant) throw new Error('Please select a color and size.');
    if (!variant.color) throw new Error('Please select a color.');
    if (!variant.size) throw new Error('Please select a size.');

    const stock = inventorySnap.exists() ? ((inventorySnap.data() as Inventory).variant_stock?.[variantId] ?? 0) : 0;
    if (stock <= 0) throw new Error('This size is out of stock.');

    const existing = await findExisting(userId, productId, variantId, false);
    if (existing) {
      const currentQty = (existing.data().quantity as number) ?? 0;
      const nextQty = currentQty + quantity;
      if (nextQty > stock) throw new Error(`Only ${stock} left in stock.`);
      await updateDoc(existing.ref, { quantity: nextQty });
    } else {
      if (quantity > stock) throw new Error(`Only ${stock} left in stock.`);
      const image = product.images.find((img) => img.color === variant.color)?.url ?? product.coverImage ?? product.imageUrl ?? '';
      await addDoc(cartCollection(userId), {
        productId,
        variantId,
        sellerId: product.seller_id,
        size: variant.size,
        color: variant.color,
        quantity,
        price: variant.price_override ?? product.price,
        image,
        addedAt: new Date().toISOString(),
        savedForLater: false,
      });
    }
    return this.list(userId);
  },

  async updateQuantity(userId: string, cartItemId: string, quantity: number): Promise<CartLineItem[]> {
    await updateDoc(doc(db, 'users', userId, 'cart', cartItemId), { quantity });
    return this.list(userId);
  },

  async removeItem(userId: string, cartItemId: string): Promise<CartLineItem[]> {
    await deleteDoc(doc(db, 'users', userId, 'cart', cartItemId));
    return this.list(userId);
  },

  async saveForLater(userId: string, cartItemId: string, saved: boolean): Promise<CartLineItem[]> {
    await updateDoc(doc(db, 'users', userId, 'cart', cartItemId), { savedForLater: saved });
    return this.list(userId);
  },

  /** Clears only the active cart (not saved-for-later items) — called after a successful checkout. */
  async clear(userId: string): Promise<void> {
    const raw = await fetchRaw(userId, false);
    await Promise.all(raw.map((item) => deleteDoc(doc(db, 'users', userId, 'cart', item.id))));
  },

  /** Removes exactly the purchased lines from the cart post-checkout (a partial buy — e.g. Buy Now
   *  on one item while other unrelated items remain in the cart — must not wipe the whole cart). */
  async removeItems(userId: string, cartItemIds: string[]): Promise<void> {
    await Promise.all(cartItemIds.map((id) => deleteDoc(doc(db, 'users', userId, 'cart', id))));
  },
};
