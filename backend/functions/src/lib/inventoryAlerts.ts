import { createNotification } from './notifications';

export interface AlertFlags {
  low_stock_alert_sent: boolean;
  out_of_stock_alert_sent: boolean;
}

export type PendingAlert = { kind: 'low_stock' | 'out_of_stock'; sellerId: string; productId: string; productName: string } | null;

/**
 * Pure — call this with an inventory doc's CURRENT alert flags and the stock level a transaction
 * is about to write, get back the new flags to persist plus whether a notification is owed.
 *
 * Dedup model: a "dip" below a threshold sends exactly one notification, not one per order/edit
 * that happens to land at or below it (the gap Phase 12 explicitly called out — the original
 * low-stock notification in orderPlacement.ts fired on every qualifying order). The flag resets to
 * false once stock rises back above the threshold, so a LATER dip alerts again. This intentionally
 * does not use the notification_locks/createNotificationOnce mechanism — that's a fire-once-ever
 * lock keyed by a fixed string, wrong for a condition that can legitimately recur after a restock.
 */
export function computeStockAlert(
  current: Partial<AlertFlags> | undefined,
  newTotalStock: number,
  lowStockThreshold: number,
  context: { sellerId: string; productId: string; productName: string },
): { flags: AlertFlags; alert: PendingAlert } {
  const wasLowSent = current?.low_stock_alert_sent ?? false;
  const wasOutSent = current?.out_of_stock_alert_sent ?? false;

  if (newTotalStock <= 0) {
    const alert: PendingAlert = wasOutSent ? null : { kind: 'out_of_stock', ...context };
    return { flags: { low_stock_alert_sent: true, out_of_stock_alert_sent: true }, alert };
  }
  if (newTotalStock <= lowStockThreshold) {
    const alert: PendingAlert = wasLowSent ? null : { kind: 'low_stock', ...context };
    return { flags: { low_stock_alert_sent: true, out_of_stock_alert_sent: false }, alert };
  }
  // Back above threshold — reset both so a future dip alerts again.
  return { flags: { low_stock_alert_sent: false, out_of_stock_alert_sent: false }, alert: null };
}

/** Best-effort, run after the transaction that produced it has committed — matches the existing
 *  orderPlacement.ts pattern of notifying only once a write is actually durable. */
export async function sendStockAlert(alert: PendingAlert): Promise<void> {
  if (!alert) return;
  if (alert.kind === 'out_of_stock') {
    await createNotification({
      userId: alert.sellerId,
      title: 'Out of stock',
      message: `"${alert.productName}" is now out of stock.`,
      type: 'out_of_stock',
      link: '/seller/inventory',
    });
  } else {
    await createNotification({
      userId: alert.sellerId,
      title: 'Low stock alert',
      message: `"${alert.productName}" is running low on stock.`,
      type: 'low_stock',
      link: '/seller/inventory',
    });
  }
}
