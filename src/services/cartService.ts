import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { CartItem } from '@/types';
import { getCart, saveCart } from './mock/mockUserData';
import { buildCatalog } from '@/lib/catalogGenerator';

function hydrate(items: CartItem[]): CartItem[] {
  const { products } = buildCatalog();
  return items.map((item) => {
    const product = products.find((p) => p.id === item.product_id);
    const variant = product?.variants.find((v) => v.id === item.variant_id);
    return { ...item, product, variant };
  });
}

export const cartService = {
  async list(userId: string): Promise<CartItem[]> {
    if (env.useMockData) return hydrate(getCart(userId).filter((i) => !i.saved_for_later));
    const { data, error } = await supabase
      .from('cart_items')
      .select('*, product:products(*, brand:brands(*), category:categories(*), images:product_images(*)), variant:product_variants(*)')
      .eq('user_id', userId)
      .eq('saved_for_later', false);
    if (error) throw new Error(error.message);
    return data as unknown as CartItem[];
  },

  async savedForLater(userId: string): Promise<CartItem[]> {
    if (env.useMockData) return hydrate(getCart(userId).filter((i) => i.saved_for_later));
    const { data, error } = await supabase
      .from('cart_items')
      .select('*, product:products(*, brand:brands(*), category:categories(*), images:product_images(*)), variant:product_variants(*)')
      .eq('user_id', userId)
      .eq('saved_for_later', true);
    if (error) throw new Error(error.message);
    return data as unknown as CartItem[];
  },

  async addItem(userId: string, productId: string, variantId: string, quantity = 1): Promise<CartItem[]> {
    if (env.useMockData) {
      const items = getCart(userId);
      const existing = items.find((i) => i.product_id === productId && i.variant_id === variantId && !i.saved_for_later);
      if (existing) {
        existing.quantity += quantity;
      } else {
        items.push({
          id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          user_id: userId,
          product_id: productId,
          variant_id: variantId,
          quantity,
          saved_for_later: false,
          created_at: new Date().toISOString(),
        });
      }
      saveCart(userId, items);
      return hydrate(items.filter((i) => !i.saved_for_later));
    }

    const { error } = await supabase.from('cart_items').upsert(
      { user_id: userId, product_id: productId, variant_id: variantId, quantity, saved_for_later: false },
      { onConflict: 'user_id,product_id,variant_id' },
    );
    if (error) throw new Error(error.message);
    return this.list(userId);
  },

  async updateQuantity(userId: string, cartItemId: string, quantity: number): Promise<CartItem[]> {
    if (env.useMockData) {
      const items = getCart(userId).map((i) => (i.id === cartItemId ? { ...i, quantity } : i));
      saveCart(userId, items);
      return hydrate(items.filter((i) => !i.saved_for_later));
    }
    const { error } = await supabase.from('cart_items').update({ quantity }).eq('id', cartItemId);
    if (error) throw new Error(error.message);
    return this.list(userId);
  },

  async removeItem(userId: string, cartItemId: string): Promise<CartItem[]> {
    if (env.useMockData) {
      const items = getCart(userId).filter((i) => i.id !== cartItemId);
      saveCart(userId, items);
      return hydrate(items.filter((i) => !i.saved_for_later));
    }
    const { error } = await supabase.from('cart_items').delete().eq('id', cartItemId);
    if (error) throw new Error(error.message);
    return this.list(userId);
  },

  async saveForLater(userId: string, cartItemId: string, saved: boolean): Promise<CartItem[]> {
    if (env.useMockData) {
      const items = getCart(userId).map((i) => (i.id === cartItemId ? { ...i, saved_for_later: saved } : i));
      saveCart(userId, items);
      return hydrate(items.filter((i) => !i.saved_for_later));
    }
    const { error } = await supabase.from('cart_items').update({ saved_for_later: saved }).eq('id', cartItemId);
    if (error) throw new Error(error.message);
    return this.list(userId);
  },

  async clear(userId: string): Promise<void> {
    if (env.useMockData) {
      const items = getCart(userId).filter((i) => i.saved_for_later);
      saveCart(userId, items);
      return;
    }
    const { error } = await supabase.from('cart_items').delete().eq('user_id', userId).eq('saved_for_later', false);
    if (error) throw new Error(error.message);
  },
};
