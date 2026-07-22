import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { StaffDetails, StaffMember } from '@/types';
import * as mockStaffProfiles from './mock/mockStaffProfiles';
import * as mockAuth from './mock/mockAuth';
import { authService } from './authService';

/** Staff Portal profile details — the `staff` table (migration 0019/0020) layered on top of `profiles`. */
export const staffService = {
  async getDetails(staffId: string): Promise<StaffDetails | null> {
    if (env.useMockData) return mockStaffProfiles.getStaffDetails(staffId);
    const { data, error } = await supabase.from('staff').select('*').eq('id', staffId).maybeSingle();
    if (error) throw new Error(error.message);
    return data as StaffDetails | null;
  },

  /**
   * Staff's own editable fields — deliberately just `phone` (full_name/avatar_url live on
   * `profiles`, updated via authService.updateProfile instead). shop_name/employee_id/department/
   * status/role are absent from this type on purpose: there is no code path from the Staff
   * Portal that can write them, which is what actually enforces "staff cannot change shop_name/
   * department/status", not just the UI hiding those fields.
   */
  async saveDetails(staffId: string, updates: Pick<StaffDetails, 'phone'>): Promise<StaffDetails> {
    if (env.useMockData) {
      const existing = mockStaffProfiles.ensureStaffDetails(staffId);
      const updated: StaffDetails = { ...existing, ...updates };
      mockStaffProfiles.saveStaffDetails(updated);
      return updated;
    }
    const { data, error } = await supabase
      .from('staff')
      .upsert({ id: staffId, ...updates }, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as StaffDetails;
  },

  /** Staff Settings page — Language/Notifications/Theme preferences. Theme is ALSO mirrored to
   *  localStorage by ThemeContext (immediate effect, works offline) — this is what makes it
   *  survive logging in again on a different device/browser, per StaffLayout's theme-sync effect. */
  async savePreferences(staffId: string, updates: Partial<Pick<StaffDetails, 'language' | 'notifications_enabled' | 'theme'>>): Promise<StaffDetails> {
    if (env.useMockData) {
      const existing = mockStaffProfiles.ensureStaffDetails(staffId);
      const updated: StaffDetails = { ...existing, ...updates };
      mockStaffProfiles.saveStaffDetails(updated);
      return updated;
    }
    const { data, error } = await supabase
      .from('staff')
      .upsert({ id: staffId, ...updates }, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as StaffDetails;
  },

  /** Admin's Activate/Deactivate toggle. Deactivated staff keep their row but are blocked from
   *  signing in — see authService.signIn's active-status check. */
  async setStatus(staffId: string, status: 'active' | 'inactive'): Promise<StaffDetails> {
    if (env.useMockData) {
      const existing = mockStaffProfiles.ensureStaffDetails(staffId);
      const updated: StaffDetails = { ...existing, status };
      mockStaffProfiles.saveStaffDetails(updated);
      return updated;
    }
    const { data, error } = await supabase.from('staff').update({ status }).eq('id', staffId).select().single();
    if (error) throw new Error(error.message);
    return data as StaffDetails;
  },

  /**
   * Admin's "Reset Password" action. Mock mode can set the password directly (there's no real
   * auth backend to protect). Live mode has no safe client-side way to force-set another user's
   * password — that requires the Supabase service_role key, which must never ship to the browser
   * — so it instead sends that staff member a normal password-reset email via Supabase Auth,
   * exactly like "Forgot password" does for anyone else.
   */
  async resetPassword(email: string, mockNewPassword: string): Promise<{ mode: 'direct' | 'email' }> {
    if (env.useMockData) {
      await mockAuth.mockResetPassword(email, mockNewPassword);
      return { mode: 'direct' };
    }
    await authService.requestPasswordReset(email);
    return { mode: 'email' };
  },

  /** For Admin's "View Staff Details" — every staff account plus its shop_name/status, joined app-side. */
  async listAllWithDetails(profiles: StaffMember[]): Promise<StaffMember[]> {
    if (env.useMockData) {
      const details = mockStaffProfiles.getAllStaffDetails();
      return profiles.map((p) => ({
        ...p,
        employee_id: details[p.id]?.employee_id ?? null,
        shop_name: details[p.id]?.shop_name ?? null,
        department: details[p.id]?.department ?? null,
        status: details[p.id]?.status ?? 'active',
        joined_at: details[p.id]?.created_at ?? null,
      }));
    }
    const { data, error } = await supabase.from('staff').select('*');
    if (error) throw new Error(error.message);
    const byId = new Map((data as StaffDetails[]).map((d) => [d.id, d]));
    return profiles.map((p) => ({
      ...p,
      employee_id: byId.get(p.id)?.employee_id ?? null,
      shop_name: byId.get(p.id)?.shop_name ?? null,
      department: byId.get(p.id)?.department ?? null,
      status: byId.get(p.id)?.status ?? 'active',
      joined_at: byId.get(p.id)?.created_at ?? null,
    }));
  },
};
