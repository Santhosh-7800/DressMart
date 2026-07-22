import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { Profile, ReferralRecord } from '@/types';
import * as mockReferrals from './mock/mockReferrals';
import { getProfileById } from './mock/mockAuth';
import { couponService } from './couponService';

/** Flat ₹200 off, granted to the referrer once their referral places a qualifying order. */
const REFERRER_REWARD = { discountType: 'flat' as const, discountValue: 200, minOrderValue: 999, validDays: 60 };
/** Flat ₹150 off, granted immediately to anyone who signs up with a valid referral code. */
const REFEREE_WELCOME_REWARD = { discountType: 'flat' as const, discountValue: 150, minOrderValue: 499, validDays: 30 };

function generateCouponCode(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export const referralService = {
  async getHistory(referrerId: string): Promise<ReferralRecord[]> {
    if (env.useMockData) return mockReferrals.getHistory(referrerId);
    const { data, error } = await supabase.from('referrals').select('*').eq('referrer_id', referrerId).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data as ReferralRecord[];
  },

  /**
   * Links a brand-new signup to whoever referred them and grants the new user an immediate
   * welcome coupon. Called once from AuthContext.signUp right after the account is created —
   * deliberately swallows its own errors so a referral hiccup never blocks signup.
   */
  async applyReferralCode(newProfile: Profile): Promise<void> {
    if (!newProfile.referred_by) return;
    try {
      if (env.useMockData) {
        mockReferrals.recordReferral(newProfile.referred_by, newProfile.id, newProfile.full_name, newProfile.email);
      } else {
        await supabase.from('referrals').insert({
          referrer_id: newProfile.referred_by,
          referred_user_id: newProfile.id,
          referred_name: newProfile.full_name,
          referred_email: newProfile.email,
          status: 'pending',
        });
      }
      await couponService.grantToUser(newProfile.id, {
        code: generateCouponCode('WELCOME'),
        description: "Welcome reward for joining via a friend's referral",
        ...REFEREE_WELCOME_REWARD,
      });
    } catch {
      // Referral linking is a nice-to-have, not a signup blocker — fail silently.
    }
  },

  /**
   * Called from orderService.placeOrder right after order creation. If this user was referred
   * and their referral is still pending, completes it and grants the referrer a reward coupon.
   * A no-op on every order after the first qualifying one, since by then no pending record remains.
   */
  async completeReferralIfPending(userId: string): Promise<void> {
    try {
      const profile = env.useMockData ? getProfileById(userId) : await fetchProfileLive(userId);
      if (!profile?.referred_by) return;

      if (env.useMockData) {
        const completed = mockReferrals.markCompleted(profile.referred_by, userId);
        if (!completed) return;
        const coupon = await couponService.grantToUser(profile.referred_by, {
          code: generateCouponCode('REFER'),
          description: `Reward for referring ${profile.full_name}`,
          ...REFERRER_REWARD,
        });
        mockReferrals.markRewarded(profile.referred_by, userId, coupon.code);
        return;
      }

      const { data: existing } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', profile.referred_by)
        .eq('referred_user_id', userId)
        .eq('status', 'pending')
        .maybeSingle();
      if (!existing) return;

      await supabase.from('referrals').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', existing.id);
      const coupon = await couponService.grantToUser(profile.referred_by, {
        code: generateCouponCode('REFER'),
        description: `Reward for referring ${profile.full_name}`,
        ...REFERRER_REWARD,
      });
      await supabase.from('referrals').update({ status: 'rewarded', reward_coupon_code: coupon.code }).eq('id', existing.id);
    } catch {
      // Referral rewarding is a nice-to-have, not an order blocker — fail silently.
    }
  },
};

async function fetchProfileLive(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) return null;
  return data as Profile;
}
