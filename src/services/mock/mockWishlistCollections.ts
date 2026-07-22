import type { WishlistCollection } from '@/types';
import { readStore, writeStore } from './mockStorage';

/**
 * Standalone mock store for wishlist collections. Deliberately separate from
 * mockUserData's existing wishlist get/save functions — this module never
 * reads or writes the underlying wishlist_items store, so the existing
 * wishlist (toggle/list/remove) behavior is completely unaffected.
 */

function collectionsKey(userId: string): string {
  return `wishlist-collections:${userId}`;
}

/** Global (not user-scoped) index so a share link can be resolved to its owner without knowing them upfront. */
const SHARE_INDEX_KEY = 'wishlist-share-index';

interface ShareIndexEntry {
  userId: string;
  collectionId: string;
}

function getShareIndex(): Record<string, ShareIndexEntry> {
  return readStore<Record<string, ShareIndexEntry>>(SHARE_INDEX_KEY, {});
}

function saveShareIndex(index: Record<string, ShareIndexEntry>): void {
  writeStore(SHARE_INDEX_KEY, index);
}

export function getCollections(userId: string): WishlistCollection[] {
  return readStore<WishlistCollection[]>(collectionsKey(userId), []);
}

function saveCollections(userId: string, collections: WishlistCollection[]): void {
  writeStore(collectionsKey(userId), collections);
}

export function createCollection(userId: string, name: string): WishlistCollection[] {
  const collections = getCollections(userId);
  const now = new Date().toISOString();
  collections.push({
    id: `wc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    user_id: userId,
    name,
    share_slug: null,
    product_ids: [],
    created_at: now,
    updated_at: now,
  });
  saveCollections(userId, collections);
  return collections;
}

export function renameCollection(userId: string, collectionId: string, name: string): WishlistCollection[] {
  const collections = getCollections(userId).map((c) => (c.id === collectionId ? { ...c, name, updated_at: new Date().toISOString() } : c));
  saveCollections(userId, collections);
  return collections;
}

export function deleteCollection(userId: string, collectionId: string): WishlistCollection[] {
  const collections = getCollections(userId).filter((c) => c.id !== collectionId);
  saveCollections(userId, collections);

  const index = getShareIndex();
  let changed = false;
  for (const [slug, entry] of Object.entries(index)) {
    if (entry.userId === userId && entry.collectionId === collectionId) {
      delete index[slug];
      changed = true;
    }
  }
  if (changed) saveShareIndex(index);

  return collections;
}

/** Removes productId from every collection, then files it into toCollectionId (or leaves it "Unsorted" if null). */
export function moveProductToCollection(userId: string, productId: string, toCollectionId: string | null): WishlistCollection[] {
  let collections = getCollections(userId).map((c) => ({ ...c, product_ids: c.product_ids.filter((id) => id !== productId) }));

  if (toCollectionId) {
    collections = collections.map((c) =>
      c.id === toCollectionId ? { ...c, product_ids: [...c.product_ids, productId], updated_at: new Date().toISOString() } : c,
    );
  }

  saveCollections(userId, collections);
  return collections;
}

export function shareCollection(userId: string, collectionId: string): WishlistCollection[] {
  const collections = getCollections(userId);
  const idx = collections.findIndex((c) => c.id === collectionId);
  if (idx === -1) return collections;

  let slug = collections[idx].share_slug;
  if (!slug) {
    slug = `${collectionId.slice(0, 8)}-${Math.random().toString(36).slice(2, 8)}`;
    collections[idx] = { ...collections[idx], share_slug: slug, updated_at: new Date().toISOString() };
    saveCollections(userId, collections);
  }

  const index = getShareIndex();
  index[slug] = { userId, collectionId };
  saveShareIndex(index);

  return collections;
}

export function unshareCollection(userId: string, collectionId: string): WishlistCollection[] {
  const collections = getCollections(userId);
  const idx = collections.findIndex((c) => c.id === collectionId);
  if (idx === -1) return collections;

  const slug = collections[idx].share_slug;
  collections[idx] = { ...collections[idx], share_slug: null, updated_at: new Date().toISOString() };
  saveCollections(userId, collections);

  if (slug) {
    const index = getShareIndex();
    delete index[slug];
    saveShareIndex(index);
  }

  return collections;
}

export function getSharedCollection(shareSlug: string): WishlistCollection | null {
  const entry = getShareIndex()[shareSlug];
  if (!entry) return null;
  const collection = getCollections(entry.userId).find((c) => c.id === entry.collectionId);
  if (!collection || collection.share_slug !== shareSlug) return null;
  return collection;
}
