import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { CartItem, Order, Profile, ReturnRequest } from '@/types';
import * as mockAuth from './mock/mockAuth';
import { getOrders, getCart, getReturns } from './mock/mockUserData';

/**
 * Cross-customer reads for the admin panel. Every mock per-user store (orders/cart/returns) is
 * namespaced by user id in localStorage — the only way to see "every customer's orders" in mock
 * mode is to enumerate every account that has ever signed up (mockAuth.getAllProfiles(), which is
 * NOT per-user-namespaced) and read each one's store. In live mode this is just an unrestricted
 * query, since admin/shop_owner bypass the owner-only RLS checks via is_admin().
 */
export const adminDataService = {
  async getAllProfiles(): Promise<Profile[]> {
    if (env.useMockData) return mockAuth.getAllProfiles();
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data as Profile[];
  },

  async getAllOrders(): Promise<Order[]> {
    if (env.useMockData) {
      const profiles = mockAuth.getAllProfiles();
      return profiles.flatMap((p) => getOrders(p.id)).sort((a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime());
    }
    const { data, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*), address:addresses(*)')
      .order('placed_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data as unknown as Order[];
  },

  async getAllReturns(): Promise<ReturnRequest[]> {
    if (env.useMockData) {
      const profiles = mockAuth.getAllProfiles();
      return profiles.flatMap((p) => getReturns(p.id)).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    const { data, error } = await supabase.from('returns').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data as ReturnRequest[];
  },

  async getAllCartItems(): Promise<CartItem[]> {
    if (env.useMockData) {
      const profiles = mockAuth.getAllProfiles();
      return profiles.flatMap((p) => getCart(p.id));
    }
    const { data, error } = await supabase.from('cart_items').select('*');
    if (error) throw new Error(error.message);
    return data as CartItem[];
  },
};
