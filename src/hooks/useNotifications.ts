import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '@/services/notificationService';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';

export function useNotifications() {
  const { identityId } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...queryKeys.notifications.all, identityId],
    queryFn: () => notificationService.list(identityId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [...queryKeys.notifications.all, identityId] });

  const markRead = useMutation({
    mutationFn: (notificationId: string) => notificationService.markRead(identityId, notificationId),
    onSuccess: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationService.markAllRead(identityId),
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
