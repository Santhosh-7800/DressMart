import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, runTransaction, setDoc, updateDoc, where, type Unsubscribe } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import type { Inventory, InventoryMovement } from '@/types';

function sumStock(variantStock: Record<string, number>): number {
  return Object.values(variantStock).reduce((sum, n) => sum + Math.max(0, Math.round(n || 0)), 0);
}

export const inventoryService = {
  /** One-shot read — used wherever a live subscription isn't warranted (grids, seller tables). */
  async getInventory(productId: string): Promise<Inventory | null> {
    const snap = await getDoc(doc(db, 'inventory', productId));
    return snap.exists() ? (snap.data() as Inventory) : null;
  },

  /** Batched one-shot reads, chunked to Firestore's 30-value 'in' limit — used by list-level
   *  features (facets/recommendations) that need stock for many products at once without opening
   *  a listener per product. */
  async getInventoryBatch(productIds: string[]): Promise<Record<string, Inventory>> {
    if (productIds.length === 0) return {};
    const { getDocs, query, collection, where, documentId } = await import('firebase/firestore');
    const result: Record<string, Inventory> = {};
    const chunks: string[][] = [];
    for (let i = 0; i < productIds.length; i += 30) chunks.push(productIds.slice(i, i + 30));
    await Promise.all(
      chunks.map(async (chunk) => {
        const snap = await getDocs(query(collection(db, 'inventory'), where(documentId(), 'in', chunk)));
        snap.docs.forEach((d) => {
          result[d.id] = d.data() as Inventory;
        });
      }),
    );
    return result;
  },

  /** Realtime subscription — powers the PDP's "customer sees updated quantity immediately" requirement. */
  subscribeToInventory(productId: string, callback: (inventory: Inventory | null) => void): Unsubscribe {
    return onSnapshot(doc(db, 'inventory', productId), (snap) => {
      callback(snap.exists() ? (snap.data() as Inventory) : null);
    });
  },

  /** Seller's own write — creates the paired inventory doc at product-creation time (same id as the product). */
  async createInventory(productId: string, sellerId: string, variantStock: Record<string, number>, lowStockThreshold: number): Promise<void> {
    const inventory: Inventory = {
      product_id: productId,
      seller_id: sellerId,
      total_stock: sumStock(variantStock),
      variant_stock: variantStock,
      low_stock_threshold: lowStockThreshold,
      updated_at: new Date().toISOString(),
    };
    await setDoc(doc(db, 'inventory', productId), inventory);
  },

  /**
   * Seller's own write — Inventory management page's stock editor. The editor loads a snapshot of
   * `variant_stock` and edits it as absolute per-variant quantities; if a customer's order (or
   * another seller/staff session) decremented stock via the transactional order-placement path
   * while this editor was open, a plain overwrite here would silently resurrect that already-sold
   * stock. `expectedUpdatedAt` (the `updated_at` the editor loaded) closes that race: the write is
   * rejected inside a transaction if the document has moved on since, rather than clobbering it.
   */
  async updateStock(productId: string, variantStock: Record<string, number>, lowStockThreshold: number, expectedUpdatedAt?: string): Promise<void> {
    const ref = doc(db, 'inventory', productId);
    if (!expectedUpdatedAt) {
      // No baseline to compare against (e.g. a brand-new inventory doc) — fall back to a plain write.
      await updateDoc(ref, {
        variant_stock: variantStock,
        total_stock: sumStock(variantStock),
        low_stock_threshold: lowStockThreshold,
        updated_at: new Date().toISOString(),
      });
      return;
    }
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('This product\'s inventory record no longer exists.');
      const fresh = snap.data() as Inventory;
      if (fresh.updated_at !== expectedUpdatedAt) {
        throw new Error('Stock was changed elsewhere (e.g. a new order) while you were editing. Refresh and try again.');
      }
      tx.update(ref, {
        variant_stock: variantStock,
        total_stock: sumStock(variantStock),
        low_stock_threshold: lowStockThreshold,
        updated_at: new Date().toISOString(),
      });
    });
  },

  /** Single-SKU stock correction with a mandatory reason — routes through the adjustStock Cloud
   *  Function (transactional, audited, rejects negative results) rather than a direct client write.
   *  See adjustStock.ts's docstring for why this is separate from updateStock's bulk editor above. */
  async adjustStock(productId: string, variantId: string, delta: number, reason: string): Promise<{ newQuantity: number; newTotalStock: number }> {
    const call = httpsCallable<{ productId: string; variantId: string; delta: number; reason: string }, { success: true; newQuantity: number; newTotalStock: number }>(
      functions,
      'adjustStock',
    );
    const { data } = await call({ productId, variantId, delta, reason });
    return { newQuantity: data.newQuantity, newTotalStock: data.newTotalStock };
  },

  /** Most recent stock movements for one product, newest first — powers the Inventory page's
   *  per-product "Recent Movements" panel. Read-only for the client (see firestore.rules). */
  async listMovements(productId: string, maxResults = 20): Promise<InventoryMovement[]> {
    const snap = await getDocs(
      query(collection(db, 'inventory_movements'), where('product_id', '==', productId), orderBy('created_at', 'desc'), limit(maxResults)),
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as InventoryMovement);
  },
};
