import type { RewardsTransaction, RewardsWallet } from '@/types';
import { readStore, writeStore } from './mockStorage';

function walletKey(userId: string): string {
  return `rewards-wallet:${userId}`;
}

function historyKey(userId: string): string {
  return `rewards-history:${userId}`;
}

function defaultWallet(userId: string): RewardsWallet {
  return {
    id: `wallet-${userId}`,
    user_id: userId,
    points_balance: 0,
    lifetime_points_earned: 0,
    updated_at: new Date().toISOString(),
  };
}

export function getWallet(userId: string): RewardsWallet {
  return readStore<RewardsWallet>(walletKey(userId), defaultWallet(userId));
}

function saveWallet(userId: string, wallet: RewardsWallet): void {
  writeStore(walletKey(userId), wallet);
}

export function getHistory(userId: string): RewardsTransaction[] {
  return readStore<RewardsTransaction[]>(historyKey(userId), []);
}

function saveHistory(userId: string, history: RewardsTransaction[]): void {
  writeStore(historyKey(userId), history);
}

function addTransaction(userId: string, entry: Omit<RewardsTransaction, 'id' | 'user_id' | 'created_at'>): void {
  const transaction: RewardsTransaction = {
    id: `rt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    user_id: userId,
    created_at: new Date().toISOString(),
    ...entry,
  };
  const history = getHistory(userId);
  history.unshift(transaction);
  saveHistory(userId, history);
}

export function earnPoints(userId: string, points: number, description: string, orderId: string | null): RewardsWallet {
  if (points <= 0) return getWallet(userId);
  const wallet = getWallet(userId);
  const updated: RewardsWallet = {
    ...wallet,
    points_balance: wallet.points_balance + points,
    lifetime_points_earned: wallet.lifetime_points_earned + points,
    updated_at: new Date().toISOString(),
  };
  saveWallet(userId, updated);
  addTransaction(userId, { type: 'earned', points, description, order_id: orderId });
  return updated;
}

/** Deducts up to `points` from the wallet (never below zero) and logs the redemption. */
export function redeemPoints(userId: string, points: number, description: string, orderId: string | null): RewardsWallet {
  if (points <= 0) return getWallet(userId);
  const wallet = getWallet(userId);
  const pointsToDeduct = Math.min(points, wallet.points_balance);
  const updated: RewardsWallet = {
    ...wallet,
    points_balance: wallet.points_balance - pointsToDeduct,
    updated_at: new Date().toISOString(),
  };
  saveWallet(userId, updated);
  if (pointsToDeduct > 0) {
    addTransaction(userId, { type: 'redeemed', points: -pointsToDeduct, description, order_id: orderId });
  }
  return updated;
}
