import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '@/services/notificationService';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';

export function useNotifications() {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...queryKeys.notifications.all, userId],
    queryFn: () => notificationService.list(userId),
    enabled: isAuthenticated,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [...queryKeys.notifications.all, userId] });

  const markRead = useMutation({
    mutationFn: (notificationId: string) => notificationService.markRead(userId, notificationId),
    onSuccess: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationService.markAllRead(userId),
    onSuccess: invalidate,
  });

  const items = query.data ?? [];

  return {
    notifications: items,
    unreadCount: items.filter((n) => !n.is_read).length,
    isLoading: query.isLoading,
    markRead: markRead.mutateAsync,
    markAllRead: markAllRead.mutateAsync,
  };
}
