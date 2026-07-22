import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { Profile, UserRole } from '@/types';
import * as mockAuth from './mock/mockAuth';

export const adminStaffService = {
  /** Promotes an existing account (found by email) to a backend role — there's no client-side way to mint a brand-new auth user with a role pre-set, so staff/shop_owner accounts start as a normal signup and get promoted here. */
  async setRoleByEmail(email: string, role: UserRole): Promise<Profile> {
    if (env.useMockData) {
      const profile = mockAuth.findProfileByEmail(email);
      if (!profile) throw new Error('No account found with that email. Ask them to sign up first, then add them here.');
      return mockAuth.setUserRole(profile.id, role);
    }

    const { data: existing, error: findError } = await supabase.from('profiles').select('*').eq('email', email).single();
    if (findError || !existing) throw new Error('No account found with that email. Ask them to sign up first, then add them here.');

    const { data, error } = await supabase.from('profiles').update({ role }).eq('id', existing.id).select().single();
    if (error) throw new Error(error.message);
    return data as Profile;
  },

  async removeRole(userId: string): Promise<Profile> {
    if (env.useMockData) return mockAuth.setUserRole(userId, 'customer');
    const { data, error } = await supabase.from('profiles').update({ role: 'customer' }).eq('id', userId).select().single();
    if (error) throw new Error(error.message);
    return data as Profile;
  },
};
