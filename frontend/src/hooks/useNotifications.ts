import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { notificationService } from '@/services/notificationService';
import { useAuth } from '@/contexts/AuthContext';
import type { Notification } from '@/types';

/** Realtime — a signed-in user's own notifications is a small, bounded read (see
 *  notificationService.subscribe's doc comment), so this live-updates everywhere it's used: the
 *  buyer/seller notification pages AND the Seller Layout's nav bell badge, with no polling. Mutations
 *  need no cache invalidation — the live listener already reflects the write once Firestore commits it. */
export function useNotifications() {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id ?? '';
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsubscribe = notificationService.subscribe(userId, (items) => {
      setNotifications(items);
      setIsLoading(false);
    });
    return unsubscribe;
  }, [isAuthenticated, userId]);

  const markRead = useMutation({
    mutationFn: (notificationId: string) => notificationService.markRead(userId, notificationId),
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationService.markAllRead(userId),
  });

  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.is_read).length,
    isLoading,
    markRead: markRead.mutateAsync,
    markAllRead: markAllRead.mutateAsync,
  };
}
