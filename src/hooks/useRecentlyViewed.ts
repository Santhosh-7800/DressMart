import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { recentlyViewedService } from '@/services/recentlyViewedService';
import { useAuth } from '@/contexts/AuthContext';

export function useRecentlyViewed() {
  const { identityId } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['recently-viewed', identityId],
    queryFn: () => recentlyViewedService.list(identityId),
  });

  const recordViewMutation = useMutation({
    mutationFn: (productId: string) => recentlyViewedService.recordView(identityId, productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recently-viewed', identityId] });
    },
  });

  return {
    recentlyViewed: query.data ?? [],
    isLoading: query.isLoading,
    recordView: (productId: string) => recordViewMutation.mutate(productId),
  };
}
