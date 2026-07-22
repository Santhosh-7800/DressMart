import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { SavedPaymentMethod } from '@/types';
import { getSavedPayments, saveSavedPayments } from './mock/mockUserData';

export const savedPaymentService = {
  async list(userId: string): Promise<SavedPaymentMethod[]> {
    if (env.useMockData) return getSavedPayments(userId);
    const { data, error } = await supabase.from('saved_payment_methods').select('*').eq('user_id', userId);
    if (error) throw new Error(error.message);
    return data as SavedPaymentMethod[];
  },

  async add(userId: string, method: Omit<SavedPaymentMethod, 'id' | 'user_id'>): Promise<SavedPaymentMethod[]> {
    if (env.useMockData) {
      const items = getSavedPayments(userId);
      if (method.is_default) items.forEach((m) => (m.is_default = false));
      items.push({ ...method, id: `pm-${Date.now()}`, user_id: userId });
      saveSavedPayments(userId, items);
      return items;
    }
    const { error } = await supabase.from('saved_payment_methods').insert({ ...method, user_id: userId });
    if (error) throw new Error(error.message);
    return this.list(userId);
  },

  async remove(userId: string, methodId: string): Promise<SavedPaymentMethod[]> {
    if (env.useMockData) {
      const items = getSavedPayments(userId).filter((m) => m.id !== methodId);
      saveSavedPayments(userId, items);
      return items;
    }
    const { error } = await supabase.from('saved_payment_methods').delete().eq('id', methodId);
    if (error) throw new Error(error.message);
    return this.list(userId);
  },
};
