import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { readStore, writeStore } from './mock/mockStorage';
import type { StoreSettings } from '@/types';

const SETTINGS_KEY = 'store-settings';

const DEFAULT_SETTINGS: StoreSettings = {
  id: 'store-settings-1',
  store_name: 'DressMart',
  store_address: '',
  phone: '',
  email: '',
  gst_number: '',
  logo_url: null,
  banner_url: null,
  shipping_charge: 0,
  free_shipping_threshold: 999,
  return_policy: 'Items can be returned within 7 days of delivery.',
  privacy_policy: 'We respect your privacy and never share your data with third parties.',
  updated_at: new Date().toISOString(),
};

export const storeSettingsService = {
  async get(): Promise<StoreSettings> {
    if (env.useMockData) return readStore<StoreSettings>(SETTINGS_KEY, DEFAULT_SETTINGS);
    const { data, error } = await supabase.from('store_settings').select('*').limit(1).single();
    if (error) throw new Error(error.message);
    return data as StoreSettings;
  },

  async save(settings: StoreSettings): Promise<StoreSettings> {
    const updated = { ...settings, updated_at: new Date().toISOString() };
    if (env.useMockData) {
      writeStore(SETTINGS_KEY, updated);
      return updated;
    }
    const { error } = await supabase.from('store_settings').upsert(updated);
    if (error) throw new Error(error.message);
    return updated;
  },
};
