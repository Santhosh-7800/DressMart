import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { Address } from '@/types';
import { getAddresses, saveAddresses } from './mock/mockUserData';

export const addressService = {
  async list(userId: string): Promise<Address[]> {
    if (env.useMockData) return getAddresses(userId);
    const { data, error } = await supabase.from('addresses').select('*').eq('user_id', userId).order('is_default', { ascending: false });
    if (error) throw new Error(error.message);
    return data as Address[];
  },

  async add(userId: string, address: Omit<Address, 'id' | 'user_id'>): Promise<Address[]> {
    if (env.useMockData) {
      const items = getAddresses(userId);
      if (address.is_default) items.forEach((a) => (a.is_default = false));
      items.push({ ...address, id: `addr-${Date.now()}`, user_id: userId, is_default: address.is_default || items.length === 0 });
      saveAddresses(userId, items);
      return items;
    }
    if (address.is_default) await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId);
    const { error } = await supabase.from('addresses').insert({ ...address, user_id: userId });
    if (error) throw new Error(error.message);
    return this.list(userId);
  },

  async update(userId: string, addressId: string, updates: Partial<Address>): Promise<Address[]> {
    if (env.useMockData) {
      const items = getAddresses(userId);
      if (updates.is_default) items.forEach((a) => (a.is_default = false));
      const idx = items.findIndex((a) => a.id === addressId);
      if (idx >= 0) items[idx] = { ...items[idx], ...updates };
      saveAddresses(userId, items);
      return items;
    }
    if (updates.is_default) await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId);
    const { error } = await supabase.from('addresses').update(updates).eq('id', addressId);
    if (error) throw new Error(error.message);
    return this.list(userId);
  },

  async remove(userId: string, addressId: string): Promise<Address[]> {
    if (env.useMockData) {
      const items = getAddresses(userId).filter((a) => a.id !== addressId);
      saveAddresses(userId, items);
      return items;
    }
    const { error } = await supabase.from('addresses').delete().eq('id', addressId);
    if (error) throw new Error(error.message);
    return this.list(userId);
  },
};
