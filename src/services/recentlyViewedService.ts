import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { Product, RecentlyViewedItem } from '@/types';
import { getRecentlyViewed, saveRecentlyViewed } from './mock/mockUserData';
import { productService } from './productService';

const MAX_RECENT = 12;

async function fetchRawItems(userId: string): Promise<RecentlyViewedItem[]> {
  if (env.useMockData) return getRecentlyViewed(userId);
  const { data, error } = await supabase
    .from('recently_viewed_items')
    .select('*')
    .eq('user_id', userId)
    .order('viewed_at', { ascending: false })
    .limit(MAX_RECENT);
  if (error) throw new Error(error.message);
  return data as RecentlyViewedItem[];
}

export const recentlyViewedService = {
  async list(userId: string): Promise<Product[]> {
    const items = await fetchRawItems(userId);
    if (items.length === 0) return [];
    const products = await productService.getByIds(items.map((i) => i.product_id));
    const byId = new Map(products.map((p) => [p.id, p] as const));
    return items.map((i) => byId.get(i.product_id)).filter(Boolean) as Product[];
  },

  /** Records (or bumps) a product view. Dedupes by product so re-viewing moves it back to the front. */
  async recordView(userId: string, productId: string): Promise<void> {
    if (env.useMockData) {
      const items = getRecentlyViewed(userId).filter((i) => i.product_id !== productId);
      items.unshift({ id: `rv-${Date.now()}-${Math.random().toString(36).slice(2)}`, user_id: userId, product_id: productId, viewed_at: new Date().toISOString() });
      saveRecentlyViewed(userId, items.slice(0, MAX_RECENT));
      return;
    }
    const { error } = await supabase
      .from('recently_viewed_items')
      .upsert({ user_id: userId, product_id: productId, viewed_at: new Date().toISOString() }, { onConflict: 'user_id,product_id' });
    if (error) throw new Error(error.message);
  },
};
