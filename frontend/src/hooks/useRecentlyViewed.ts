import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { recentlyViewedService } from '@/services/recentlyViewedService';
import { userActivityService } from '@/services/userActivityService';
import { productService } from '@/services/productService';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Signed-in users get this synced across devices via `user_activity/{uid}` (see
 * userActivityService); guests keep the pre-existing localStorage-only behavior (see
 * recentlyViewedService), since there's no account to roam to yet.
 */
export function useRecentlyViewed() {
  const { identityId, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['recently-viewed', identityId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!isAuthenticated) return recentlyViewedService.list(identityId);
      const activity = await userActivityService.get(identityId);
      if (activity.recently_viewed.length === 0) return [];
      const products = await productService.getByIds(activity.recently_viewed.map((e) => e.product_id));
      const byId = new Map(products.map((p) => [p.id, p] as const));
      return activity.recently_viewed.map((e) => byId.get(e.product_id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
    },
  });

  const recordViewMutation = useMutation({
    mutationFn: (productId: string) =>
      isAuthenticated ? userActivityService.recordProductView(identityId, productId) : recentlyViewedService.recordView(identityId, productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    recentlyViewed: query.data ?? [],
    isLoading: query.isLoading,
    recordView: (productId: string) => recordViewMutation.mutate(productId),
  };
}
