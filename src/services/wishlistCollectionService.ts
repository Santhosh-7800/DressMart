import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { Product, WishlistCollection } from '@/types';
import { productService } from './productService';
import * as mockCollections from './mock/mockWishlistCollections';

export interface SharedWishlistCollection {
  collection: WishlistCollection;
  products: Product[];
}

function generateShareSlug(collectionId: string): string {
  return `${collectionId.slice(0, 8)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const wishlistCollectionService = {
  async list(userId: string): Promise<WishlistCollection[]> {
    if (env.useMockData) return mockCollections.getCollections(userId);
    const { data, error } = await supabase.from('wishlist_collections').select('*').eq('user_id', userId).order('created_at');
    if (error) throw new Error(error.message);
    return data as WishlistCollection[];
  },

  async create(userId: string, name: string): Promise<WishlistCollection[]> {
    if (env.useMockData) return mockCollections.createCollection(userId, name);
    const { error } = await supabase.from('wishlist_collections').insert({ user_id: userId, name, product_ids: [] });
    if (error) throw new Error(error.message);
    return this.list(userId);
  },

  async rename(userId: string, collectionId: string, name: string): Promise<WishlistCollection[]> {
    if (env.useMockData) return mockCollections.renameCollection(userId, collectionId, name);
    const { error } = await supabase.from('wishlist_collections').update({ name }).eq('id', collectionId).eq('user_id', userId);
    if (error) throw new Error(error.message);
    return this.list(userId);
  },

  async remove(userId: string, collectionId: string): Promise<WishlistCollection[]> {
    if (env.useMockData) return mockCollections.deleteCollection(userId, collectionId);
    const { error } = await supabase.from('wishlist_collections').delete().eq('id', collectionId).eq('user_id', userId);
    if (error) throw new Error(error.message);
    return this.list(userId);
  },

  /** Removes productId from all of the user's collections, then files it into toCollectionId (or leaves it Unsorted if null). */
  async moveProduct(userId: string, productId: string, toCollectionId: string | null): Promise<WishlistCollection[]> {
    if (env.useMockData) return mockCollections.moveProductToCollection(userId, productId, toCollectionId);

    const collections = await this.list(userId);
    await Promise.all(
      collections
        .filter((c) => c.product_ids.includes(productId))
        .map((c) => supabase.from('wishlist_collections').update({ product_ids: c.product_ids.filter((id) => id !== productId) }).eq('id', c.id)),
    );

    if (toCollectionId) {
      const target = collections.find((c) => c.id === toCollectionId);
      if (target) {
        const nextIds = [...target.product_ids.filter((id) => id !== productId), productId];
        const { error } = await supabase.from('wishlist_collections').update({ product_ids: nextIds }).eq('id', toCollectionId);
        if (error) throw new Error(error.message);
      }
    }

    return this.list(userId);
  },

  async share(userId: string, collectionId: string): Promise<WishlistCollection[]> {
    if (env.useMockData) return mockCollections.shareCollection(userId, collectionId);
    const collections = await this.list(userId);
    const existing = collections.find((c) => c.id === collectionId);
    if (existing && !existing.share_slug) {
      const { error } = await supabase.from('wishlist_collections').update({ share_slug: generateShareSlug(collectionId) }).eq('id', collectionId).eq('user_id', userId);
      if (error) throw new Error(error.message);
    }
    return this.list(userId);
  },

  async unshare(userId: string, collectionId: string): Promise<WishlistCollection[]> {
    if (env.useMockData) return mockCollections.unshareCollection(userId, collectionId);
    const { error } = await supabase.from('wishlist_collections').update({ share_slug: null }).eq('id', collectionId).eq('user_id', userId);
    if (error) throw new Error(error.message);
    return this.list(userId);
  },

  async getShared(shareSlug: string): Promise<SharedWishlistCollection | null> {
    if (env.useMockData) {
      const collection = mockCollections.getSharedCollection(shareSlug);
      if (!collection) return null;
      const products = await productService.getByIds(collection.product_ids);
      return { collection, products };
    }
    const { data, error } = await supabase.from('wishlist_collections').select('*').eq('share_slug', shareSlug).maybeSingle();
    if (error || !data) return null;
    const collection = data as WishlistCollection;
    const products = await productService.getByIds(collection.product_ids);
    return { collection, products };
  },
};
