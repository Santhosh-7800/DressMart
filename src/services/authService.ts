import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { Profile } from '@/types';
import * as mockAuth from './mock/mockAuth';

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  referralCode?: string;
}

/** The one designated admin account — always forced to role='admin', regardless of how its profile row was created. */
const ADMIN_EMAIL = 'admin@dressmart.com';

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) return null;
  const profile = data as Profile;

  // Defense-in-depth alongside the handle_new_user() trigger (migration 0018) — if this profile's
  // email is the designated admin account but its role hasn't caught up (e.g. a row predating that
  // migration), self-heal it here on every session load/sign-in rather than leaving it stuck.
  if (profile.email.toLowerCase() === ADMIN_EMAIL && profile.role !== 'admin') {
    const { data: updated, error: updateError } = await supabase.from('profiles').update({ role: 'admin' }).eq('id', userId).select().single();
    if (!updateError && updated) return updated as Profile;
  }

  return profile;
}

export const authService = {
  async getSession(): Promise<Profile | null> {
    if (env.useMockData) return mockAuth.getSession();
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) return null;
    return fetchProfile(data.session.user.id);
  },

  async signUp(input: SignUpInput): Promise<Profile> {
    if (env.useMockData) return mockAuth.mockSignUp(input);

    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { full_name: input.fullName, phone: input.phone ?? null, referred_by_code: input.referralCode ?? null },
        emailRedirectTo: `${env.siteUrl}/login`,
      },
    });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Sign up failed. Please try again.');

    const profile = await fetchProfile(data.user.id);
    if (!profile) throw new Error('Account created. Please verify your email before logging in.');
    return profile;
  },

  async signIn(email: string, password: string): Promise<Profile> {
    if (env.useMockData) return mockAuth.mockSignIn(email, password);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    const profile = await fetchProfile(data.user.id);
    if (!profile) throw new Error('Could not load your profile. Please try again.');

    if (profile.role === 'staff') {
      const { data: staffRow } = await supabase.from('staff').select('status').eq('id', profile.id).maybeSingle();
      if (staffRow?.status === 'inactive') {
        await supabase.auth.signOut();
        throw new Error('Your staff account has been deactivated. Contact your administrator.');
      }
    }

    return profile;
  },

  async signInWithGoogle(): Promise<void> {
    if (env.useMockData) {
      await mockAuth.mockSignIn('demo@dressmart.com', 'password123');
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${env.siteUrl}/` },
    });
    if (error) throw new Error(error.message);
  },

  async signOut(): Promise<void> {
    if (env.useMockData) return mockAuth.mockSignOut();
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  },

  async requestPasswordReset(email: string): Promise<void> {
    if (env.useMockData) return mockAuth.mockRequestPasswordReset(email);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${env.siteUrl}/reset-password`,
    });
    if (error) throw new Error(error.message);
  },

  async resetPassword(email: string, newPassword: string): Promise<void> {
    if (env.useMockData) return mockAuth.mockResetPassword(email, newPassword);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  },

  /**
   * Self-service "Change Password" (as opposed to the forgot-password flow above, which doesn't
   * check a current password). Verifies currentPassword first — mock mode checks it directly;
   * live mode has no separate "verify password" API, so it re-authenticates via
   * signInWithPassword, which refreshes the session without signing the user out, then calls
   * updateUser. The caller stays logged in throughout.
   */
  async changeOwnPassword(email: string, currentPassword: string, newPassword: string): Promise<void> {
    if (env.useMockData) {
      if (!mockAuth.mockVerifyPassword(email, currentPassword)) throw new Error('Current password is incorrect.');
      return mockAuth.mockResetPassword(email, newPassword);
    }
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (verifyError) throw new Error('Current password is incorrect.');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  },

  async sendOtp(phone: string): Promise<string | void> {
    if (env.useMockData) return mockAuth.mockSendOtp(phone);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw new Error(error.message);
  },

  async verifyOtp(phone: string, code: string): Promise<boolean> {
    if (env.useMockData) return mockAuth.mockVerifyOtp(phone, code);
    const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
    return !error;
  },

  async updateProfile(userId: string, updates: Partial<Pick<Profile, 'full_name' | 'phone' | 'avatar_url'>>): Promise<Profile> {
    if (env.useMockData) return mockAuth.mockUpdateProfile(userId, updates);
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single();
    if (error) throw new Error(error.message);
    return data as Profile;
  },
};
