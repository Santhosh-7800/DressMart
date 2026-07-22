import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { Banner } from '@/types';
import { getAllBanners, saveBanner, deleteBanner } from './mock/mockAdminBanners';

export const bannerService = {
  async list(): Promise<Banner[]> {
    if (env.useMockData) return getAllBanners().filter((b) => b.is_active);
    const { data, error } = await supabase.from('banners').select('*').eq('is_active', true).order('sort_order');
    if (error) throw new Error(error.message);
    return data as Banner[];
  },

  /** All offers regardless of is_active — the admin Offers page manages both live and paused ones. */
  async listAll(): Promise<Banner[]> {
    if (env.useMockData) return getAllBanners();
    const { data, error } = await supabase.from('banners').select('*').order('sort_order');
    if (error) throw new Error(error.message);
    return data as Banner[];
  },

  async save(banner: Banner): Promise<Banner> {
    if (env.useMockData) {
      saveBanner(banner);
      return banner;
    }
    const { error } = await supabase.from('banners').upsert(banner);
    if (error) throw new Error(error.message);
    return banner;
  },

  async remove(bannerId: string): Promise<void> {
    if (env.useMockData) {
      deleteBanner(bannerId);
      return;
    }
    const { error } = await supabase.from('banners').delete().eq('id', bannerId);
    if (error) throw new Error(error.message);
  },
};
