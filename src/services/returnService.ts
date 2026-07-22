import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { Order, ReturnRequest } from '@/types';
import { getOrders, getReturns, saveOrders, saveReturns } from './mock/mockUserData';
import { RETURN_STATUS_LABELS, nextReturnStatus } from '@/lib/returnStatus';

export const returnService = {
  async list(userId: string): Promise<ReturnRequest[]> {
    if (env.useMockData) return getReturns(userId);
    const { data, error } = await supabase.from('returns').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data as ReturnRequest[];
  },

  async request(userId: string, order: Order, orderItemId: string, reason: string, comment: string): Promise<ReturnRequest> {
    const item = order.items.find((i) => i.id === orderItemId);
    if (!item) throw new Error('Order item not found.');

    const now = new Date().toISOString();
    const returnRequest: ReturnRequest = {
      id: `return-${Date.now()}`,
      order_id: order.id,
      order_item_id: orderItemId,
      user_id: userId,
      reason,
      comment: comment || null,
      status: 'requested',
      refund_amount: item.total_price,
      timeline: [{ status: 'requested', label: RETURN_STATUS_LABELS.requested, timestamp: now }],
      created_at: now,
    };

    if (env.useMockData) {
      const returns = getReturns(userId);
      returns.push(returnRequest);
      saveReturns(userId, returns);

      const orders = getOrders(userId);
      const orderIdx = orders.findIndex((o) => o.id === order.id);
      if (orderIdx >= 0) {
        orders[orderIdx].items = orders[orderIdx].items.map((i) => (i.id === orderItemId ? { ...i, return_status: 'requested' } : i));
        saveOrders(userId, orders);
      }
      return returnRequest;
    }

    const { data, error } = await supabase.from('returns').insert(returnRequest).select().single();
    if (error) throw new Error(error.message);
    await supabase.from('order_items').update({ return_status: 'requested' }).eq('id', orderItemId);
    return data as ReturnRequest;
  },

  /** Demo-only progress simulator (mirrors orderService.simulateProgress) — this project has no fulfillment backend to actually advance a return through pickup/refund. */
  async simulateProgress(userId: string, returnId: string): Promise<ReturnRequest> {
    const returns = getReturns(userId);
    const idx = returns.findIndex((r) => r.id === returnId);
    if (idx === -1) throw new Error('Return request not found.');

    const next = nextReturnStatus(returns[idx].status);
    if (!next) return returns[idx];

    const timelineEntry = { status: next, label: RETURN_STATUS_LABELS[next], timestamp: new Date().toISOString() };
    returns[idx] = { ...returns[idx], status: next, timeline: [...(returns[idx].timeline ?? []), timelineEntry] };
    saveReturns(userId, returns);

    if (next === 'approved' || next === 'refunded') {
      const orders = getOrders(userId);
      const orderIdx = orders.findIndex((o) => o.id === returns[idx].order_id);
      if (orderIdx >= 0) {
        orders[orderIdx].items = orders[orderIdx].items.map((i) => (i.id === returns[idx].order_item_id ? { ...i, return_status: next } : i));
        saveOrders(userId, orders);
      }
    }

    return returns[idx];
  },
};
