import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { WishlistItem } from '@/types';
import { getWishlist, saveWishlist } from './mock/mockUserData';
import { buildCatalog } from '@/lib/catalogGenerator';

function hydrate(items: WishlistItem[]): WishlistItem[] {
  const { products } = buildCatalog();
  return items.map((item) => ({ ...item, product: products.find((p) => p.id === item.product_id) }));
}

export const wishlistService = {
  async list(userId: string): Promise<WishlistItem[]> {
    if (env.useMockData) return hydrate(getWishlist(userId));
    const { data, error } = await supabase
      .from('wishlist_items')
      .select('*, product:products(*, brand:brands(*), category:categories(*), images:product_images(*))')
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return data as unknown as WishlistItem[];
  },

  async toggle(userId: string, productId: string): Promise<{ items: WishlistItem[]; added: boolean }> {
    if (env.useMockData) {
      const items = getWishlist(userId);
      const existingIdx = items.findIndex((i) => i.product_id === productId);
      let added = false;
      if (existingIdx >= 0) {
        items.splice(existingIdx, 1);
      } else {
        items.push({ id: `wish-${Date.now()}`, user_id: userId, product_id: productId, created_at: new Date().toISOString() });
        added = true;
      }
      saveWishlist(userId, items);
      return { items: hydrate(items), added };
    }

    const { data: existing } = await supabase.from('wishlist_items').select('id').eq('user_id', userId).eq('product_id', productId).maybeSingle();
    if (existing) {
      await supabase.from('wishlist_items').delete().eq('id', existing.id);
      return { items: await this.list(userId), added: false };
    }
    const { error } = await supabase.from('wishlist_items').insert({ user_id: userId, product_id: productId });
    if (error) throw new Error(error.message);
    return { items: await this.list(userId), added: true };
  },

  async remove(userId: string, wishlistItemId: string): Promise<WishlistItem[]> {
    if (env.useMockData) {
      const items = getWishlist(userId).filter((i) => i.id !== wishlistItemId);
      saveWishlist(userId, items);
      return hydrate(items);
    }
    const { error } = await supabase.from('wishlist_items').delete().eq('id', wishlistItemId);
    if (error) throw new Error(error.message);
    return this.list(userId);
  },
};
