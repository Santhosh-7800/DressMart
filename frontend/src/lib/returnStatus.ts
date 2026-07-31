import type { ReturnStatus } from '@/types';

export const RETURN_REASONS = ['Wrong size', 'Damaged product', 'Not as described', 'Changed my mind', 'Better price available elsewhere'];

/** Progression order for a return that isn't rejected — used to compute the next status and the timeline stepper. */
export const RETURN_HAPPY_PATH: ReturnStatus[] = ['requested', 'approved', 'pickup_scheduled', 'received', 'refunded'];

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  requested: 'Return Requested',
  approved: 'Return Approved',
  pickup_scheduled: 'Pickup Scheduled',
  received: 'Item Received',
  refunded: 'Refund Completed',
  rejected: 'Return Rejected',
};

export const RETURN_STATUS_BADGE_CLASS: Record<ReturnStatus, string> = {
  requested: 'badge-accent',
  approved: 'badge-accent',
  pickup_scheduled: 'badge-accent',
  received: 'badge-accent',
  refunded: 'badge-success',
  rejected: 'badge-danger',
};

/** One return request bundles pickup logistics and the refund itself — these two views are derived from the single status field rather than tracked as separate columns. */
export function pickupStatusLabel(status: ReturnStatus): string {
  switch (status) {
    case 'requested':
      return 'Pickup Pending';
    case 'approved':
      return 'Pickup Being Scheduled';
    case 'pickup_scheduled':
      return 'Pickup Scheduled';
    case 'received':
    case 'refunded':
      return 'Item Picked Up';
    case 'rejected':
      return 'Not Applicable';
  }
}

export function refundStatusLabel(status: ReturnStatus): string {
  switch (status) {
    case 'requested':
      return 'Pending Approval';
    case 'approved':
    case 'pickup_scheduled':
      return 'Awaiting Pickup';
    case 'received':
      return 'Refund Processing';
    case 'refunded':
      return 'Refund Completed';
    case 'rejected':
      return 'Refund Rejected';
  }
}

export function nextReturnStatus(status: ReturnStatus): ReturnStatus | null {
  const idx = RETURN_HAPPY_PATH.indexOf(status);
  if (idx === -1 || idx === RETURN_HAPPY_PATH.length - 1) return null;
  return RETURN_HAPPY_PATH[idx + 1];
}
