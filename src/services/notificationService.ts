import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { Notification } from '@/types';
import { getNotifications, saveNotifications } from './mock/mockUserData';

function seedIfEmpty(userId: string): Notification[] {
  const existing = getNotifications(userId);
  if (existing.length > 0) return existing;
  const seeded: Notification[] = [
    { id: 'n1', user_id: userId, title: 'Welcome to DressMart!', message: 'Explore Men\'s and Kids\' wear with exclusive launch offers.', type: 'system', is_read: false, link: '/', created_at: new Date().toISOString() },
    { id: 'n2', user_id: userId, title: 'Weekend Sale is live', message: 'Up to 45% off on jackets and hoodies. Shop now before it ends.', type: 'offer', is_read: false, link: '/men/jackets', created_at: new Date(Date.now() - 3600_000).toISOString() },
  ];
  saveNotifications(userId, seeded);
  return seeded;
}

export const notificationService = {
  /** Used by Admin's staff-product approve/reject actions (gated by that staff member's own
   *  "notify me" preference — see staffService/StaffSettingsPage) and available generally for any
   *  future system-generated notification. */
  async create(userId: string, input: Pick<Notification, 'title' | 'message' | 'type' | 'link'>): Promise<void> {
    if (env.useMockData) {
      const notification: Notification = { id: crypto.randomUUID(), user_id: userId, is_read: false, created_at: new Date().toISOString(), ...input };
      saveNotifications(userId, [notification, ...getNotifications(userId)]);
      return;
    }
    const { error } = await supabase.from('notifications').insert({ user_id: userId, ...input });
    if (error) throw new Error(error.message);
  },

  async list(userId: string): Promise<Notification[]> {
    if (env.useMockData) return [...seedIfEmpty(userId)].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data as Notification[];
  },

  async markRead(userId: string, notificationId: string): Promise<Notification[]> {
    if (env.useMockData) {
      const items = getNotifications(userId).map((n) => (n.id === notificationId ? { ...n, is_read: true } : n));
      saveNotifications(userId, items);
      return items;
    }
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
    if (error) throw new Error(error.message);
    return this.list(userId);
  },

  async markAllRead(userId: string): Promise<Notification[]> {
    if (env.useMockData) {
      const items = getNotifications(userId).map((n) => ({ ...n, is_read: true }));
      saveNotifications(userId, items);
      return items;
    }
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
    if (error) throw new Error(error.message);
    return this.list(userId);
  },
};
