import type { ExchangeStatus } from '@/types';

export const EXCHANGE_REASONS = ['Wrong size', 'Wrong color', 'Damaged product', 'Changed my mind', 'Different design/style preferred'];

/** Progression order for an exchange that isn't rejected — used to compute the next status and the timeline stepper. */
export const EXCHANGE_HAPPY_PATH: ExchangeStatus[] = ['requested', 'approved', 'pickup_scheduled', 'exchanged'];

export const EXCHANGE_STATUS_LABELS: Record<ExchangeStatus, string> = {
  requested: 'Exchange Requested',
  approved: 'Exchange Approved',
  pickup_scheduled: 'Pickup Scheduled',
  exchanged: 'Exchange Completed',
  rejected: 'Exchange Rejected',
};

export const EXCHANGE_STATUS_BADGE_CLASS: Record<ExchangeStatus, string> = {
  requested: 'badge-accent',
  approved: 'badge-accent',
  pickup_scheduled: 'badge-accent',
  exchanged: 'badge-success',
  rejected: 'badge-danger',
};

export function nextExchangeStatus(status: ExchangeStatus): ExchangeStatus | null {
  const idx = EXCHANGE_HAPPY_PATH.indexOf(status);
  if (idx === -1 || idx === EXCHANGE_HAPPY_PATH.length - 1) return null;
  return EXCHANGE_HAPPY_PATH[idx + 1];
}
