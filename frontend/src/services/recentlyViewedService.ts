import type { Product } from '@/types';
import { productService } from './productService';

const MAX_RECENT = 12;
const STORAGE_PREFIX = 'dressmart:recently-viewed:';

/**
 * Recently-viewed tracking, kept as localStorage rather than a Firestore subcollection — this is a
 * minor, purely client-side personalization signal (see usePersonalizedRecommendations), not core
 * product/inventory data, so it doesn't warrant its own `users/{uid}/recently_viewed` collection +
 * firestore.rules entry. Keyed by identityId (real uid once signed in, guest id otherwise — see
 * AuthContext), so it naturally carries across a guest-then-signed-in session without any merge step.
 */
interface StoredEntry {
  product_id: string;
  viewed_at: string;
}

function readEntries(identityId: string): StoredEntry[] {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${identityId}`);
    return raw ? (JSON.parse(raw) as StoredEntry[]) : [];
  } catch {
    return [];
  }
}

function writeEntries(identityId: string, entries: StoredEntry[]): void {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${identityId}`, JSON.stringify(entries.slice(0, MAX_RECENT)));
  } catch {
    // localStorage unavailable (private browsing quota, etc.) — fail silently, feature just no-ops.
  }
}

export const recentlyViewedService = {
  async list(identityId: string): Promise<Product[]> {
    const entries = readEntries(identityId);
    if (entries.length === 0) return [];
    const products = await productService.getByIds(entries.map((e) => e.product_id));
    const byId = new Map(products.map((p) => [p.id, p] as const));
    return entries.map((e) => byId.get(e.product_id)).filter((p): p is Product => Boolean(p));
  },

  /** Records (or bumps) a product view. Dedupes by product so re-viewing moves it back to the front. */
  async recordView(identityId: string, productId: string): Promise<void> {
    const entries = readEntries(identityId).filter((e) => e.product_id !== productId);
    entries.unshift({ product_id: productId, viewed_at: new Date().toISOString() });
    writeEntries(identityId, entries);
  },
};
