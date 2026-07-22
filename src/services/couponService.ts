import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { Coupon } from '@/types';
import { getCoupons, addCoupon, upsertCoupon, removeCoupon } from './mock/mockUserData';

export const couponService = {
  /** Every coupon (active or not, public or personally-granted) — the admin Coupons page manages all of them. */
  async listAllForAdmin(): Promise<Coupon[]> {
    if (env.useMockData) return getCoupons();
    const { data, error } = await supabase.from('coupons').select('*').order('valid_from', { ascending: false });
    if (error) throw new Error(error.message);
    return data as Coupon[];
  },

  async save(coupon: Coupon): Promise<Coupon> {
    if (env.useMockData) {
      upsertCoupon(coupon);
      return coupon;
    }
    const { error } = await supabase.from('coupons').upsert(coupon);
    if (error) throw new Error(error.message);
    return coupon;
  },

  async remove(couponId: string): Promise<void> {
    if (env.useMockData) {
      removeCoupon(couponId);
      return;
    }
    const { error } = await supabase.from('coupons').delete().eq('id', couponId);
    if (error) throw new Error(error.message);
  },

  /** Public catalog coupons, plus any privately-granted coupons owned by `userId` (e.g. referral rewards). */
  async list(userId?: string): Promise<Coupon[]> {
    if (env.useMockData) {
      return getCoupons().filter((c) => c.is_active && (!c.granted_to_user_id || c.granted_to_user_id === userId));
    }
    const query = supabase.from('coupons').select('*').eq('is_active', true);
    const { data, error } = userId
      ? await query.or(`granted_to_user_id.is.null,granted_to_user_id.eq.${userId}`)
      : await query.is('granted_to_user_id', null);
    if (error) throw new Error(error.message);
    return data as Coupon[];
  },

  async validate(code: string, orderValue: number, userId?: string): Promise<Coupon> {
    const coupons = env.useMockData ? getCoupons() : await this.list(userId);
    const coupon = coupons.find((c) => c.code.toLowerCase() === code.toLowerCase());
    if (!coupon) throw new Error('Invalid coupon code.');
    if (coupon.granted_to_user_id && coupon.granted_to_user_id !== userId) {
      throw new Error('This coupon is not valid for your account.');
    }
    if (!coupon.is_active) throw new Error('This coupon is no longer active.');
    const now = new Date();
    if (now < new Date(coupon.valid_from) || now > new Date(coupon.valid_until)) {
      throw new Error('This coupon has expired.');
    }
    if (orderValue < coupon.min_order_value) {
      throw new Error(`Add items worth ₹${coupon.min_order_value - orderValue} more to use this coupon.`);
    }
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
      throw new Error('This coupon has reached its usage limit.');
    }
    return coupon;
  },

  /** Mints a single-use, privately-owned coupon for one user — used by the referral program (and reusable for any future "personal offer" flow). */
  async grantToUser(
    userId: string,
    input: { code: string; description: string; discountType: Coupon['discount_type']; discountValue: number; minOrderValue: number; validDays: number },
  ): Promise<Coupon> {
    const now = new Date();
    const coupon: Coupon = {
      id: `coupon-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: input.code,
      description: input.description,
      discount_type: input.discountType,
      discount_value: input.discountValue,
      min_order_value: input.minOrderValue,
      max_discount: null,
      valid_from: now.toISOString(),
      valid_until: new Date(now.getTime() + input.validDays * 24 * 60 * 60 * 1000).toISOString(),
      is_active: true,
      usage_limit: 1,
      used_count: 0,
      granted_to_user_id: userId,
    };

    if (env.useMockData) {
      addCoupon(coupon);
      return coupon;
    }

    const { id: _id, ...insertPayload } = coupon;
    const { data, error } = await supabase.from('coupons').insert(insertPayload).select().single();
    if (error) throw new Error(error.message);
    return data as Coupon;
  },
};
