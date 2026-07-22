import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { StylePreferences } from '@/types';
import { getStylePreferences, saveStylePreferences } from './mock/mockUserData';

export type StylePreferencesInput = Omit<StylePreferences, 'id' | 'user_id' | 'updated_at'>;

export const stylePreferencesService = {
  async get(userId: string): Promise<StylePreferences | null> {
    if (env.useMockData) return getStylePreferences(userId);
    const { data, error } = await supabase.from('style_preferences').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data as StylePreferences | null;
  },

  async save(userId: string, input: StylePreferencesInput): Promise<StylePreferences> {
    if (env.useMockData) return saveStylePreferences(userId, input);
    const { data, error } = await supabase
      .from('style_preferences')
      .upsert({ user_id: userId, ...input, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as StylePreferences;
  },
};
