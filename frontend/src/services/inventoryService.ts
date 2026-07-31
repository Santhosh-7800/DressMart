import { doc, getDoc, onSnapshot, setDoc, updateDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Inventory } from '@/types';

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

  /** Seller's own write — Inventory management page's stock editor. */
  async updateStock(productId: string, variantStock: Record<string, number>, lowStockThreshold: number): Promise<void> {
    await updateDoc(doc(db, 'inventory', productId), {
      variant_stock: variantStock,
      total_stock: sumStock(variantStock),
      low_stock_threshold: lowStockThreshold,
      updated_at: new Date().toISOString(),
    });
  },
};
