import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { RewardsTransaction, RewardsWallet } from '@/types';
import * as mockRewards from './mock/mockRewards';

/** Earn 1 point for every ₹10 spent (based on the final order total). */
export const EARN_RUPEES_PER_POINT = 10;
/** Redeem 5 points for ₹1 off an order. */
export const REDEEM_POINTS_PER_RUPEE = 5;

export function calculatePointsEarned(orderTotal: number): number {
  return Math.floor(Math.max(orderTotal, 0) / EARN_RUPEES_PER_POINT);
}

export function calculateRedemptionValue(points: number): number {
  return Math.floor(Math.max(points, 0) / REDEEM_POINTS_PER_RUPEE);
}

export const rewardsService = {
  async getWallet(userId: string): Promise<RewardsWallet> {
    if (env.useMockData) return mockRewards.getWallet(userId);
    const { data, error } = await supabase.from('rewards_wallets').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data as RewardsWallet;

    const { data: created, error: createError } = await supabase
      .from('rewards_wallets')
      .insert({ user_id: userId, points_balance: 0, lifetime_points_earned: 0 })
      .select()
      .single();
    if (createError) throw new Error(createError.message);
    return created as RewardsWallet;
  },

  async getHistory(userId: string): Promise<RewardsTransaction[]> {
    if (env.useMockData) return mockRewards.getHistory(userId);
    const { data, error } = await supabase.from('rewards_transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data as RewardsTransaction[];
  },

  /**
   * Credits points for a completed order. Called from orderService.placeOrder right after the
   * order is created — deliberately swallows its own errors so a rewards hiccup never blocks
   * an otherwise-successful checkout.
   */
  async earnPointsForOrder(userId: string, orderTotal: number, orderId: string): Promise<void> {
    const points = calculatePointsEarned(orderTotal);
    if (points <= 0) return;
    try {
      if (env.useMockData) {
        mockRewards.earnPoints(userId, points, 'Earned on order', orderId);
        return;
      }
      const wallet = await this.getWallet(userId);
      await supabase
        .from('rewards_wallets')
        .update({ points_balance: wallet.points_balance + points, lifetime_points_earned: wallet.lifetime_points_earned + points })
        .eq('user_id', userId);
      await supabase.from('rewards_transactions').insert({ user_id: userId, type: 'earned', points, description: 'Earned on order', order_id: orderId });
    } catch {
      // Rewards crediting is a nice-to-have, not a checkout blocker — fail silently.
    }
  },

  async redeemPoints(userId: string, points: number, orderId: string | null): Promise<RewardsWallet> {
    if (env.useMockData) return mockRewards.redeemPoints(userId, points, 'Redeemed on order', orderId);

    const wallet = await this.getWallet(userId);
    const pointsToDeduct = Math.min(points, wallet.points_balance);
    const { data, error } = await supabase
      .from('rewards_wallets')
      .update({ points_balance: wallet.points_balance - pointsToDeduct })
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (pointsToDeduct > 0) {
      await supabase.from('rewards_transactions').insert({ user_id: userId, type: 'redeemed', points: -pointsToDeduct, description: 'Redeemed on order', order_id: orderId });
    }
    return data as RewardsWallet;
  },
};
