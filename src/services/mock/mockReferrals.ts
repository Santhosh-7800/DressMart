import type { ReferralRecord } from '@/types';
import { readStore, writeStore } from './mockStorage';

function historyKey(referrerId: string): string {
  return `referral-history:${referrerId}`;
}

export function getHistory(referrerId: string): ReferralRecord[] {
  return readStore<ReferralRecord[]>(historyKey(referrerId), []);
}

function saveHistory(referrerId: string, records: ReferralRecord[]): void {
  writeStore(historyKey(referrerId), records);
}

export function recordReferral(referrerId: string, referredUserId: string, referredName: string, referredEmail: string): ReferralRecord {
  const record: ReferralRecord = {
    id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    referrer_id: referrerId,
    referred_user_id: referredUserId,
    referred_name: referredName,
    referred_email: referredEmail,
    status: 'pending',
    reward_coupon_code: null,
    created_at: new Date().toISOString(),
    completed_at: null,
  };
  const history = getHistory(referrerId);
  history.unshift(record);
  saveHistory(referrerId, history);
  return record;
}

/** Advances a referee's still-pending record to 'completed'. Returns null if none exists (already processed, or never referred). */
export function markCompleted(referrerId: string, referredUserId: string): ReferralRecord | null {
  const history = getHistory(referrerId);
  const idx = history.findIndex((r) => r.referred_user_id === referredUserId && r.status === 'pending');
  if (idx === -1) return null;
  history[idx] = { ...history[idx], status: 'completed', completed_at: new Date().toISOString() };
  saveHistory(referrerId, history);
  return history[idx];
}

export function markRewarded(referrerId: string, referredUserId: string, couponCode: string): ReferralRecord | null {
  const history = getHistory(referrerId);
  const idx = history.findIndex((r) => r.referred_user_id === referredUserId && r.status === 'completed');
  if (idx === -1) return null;
  history[idx] = { ...history[idx], status: 'rewarded', reward_coupon_code: couponCode };
  saveHistory(referrerId, history);
  return history[idx];
}
