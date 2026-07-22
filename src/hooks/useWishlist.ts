import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { wishlistService } from '@/services/wishlistService';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';

export function useWishlist() {
  const { identityId } = useAuth();
  const queryClient = useQueryClient();

  const wishlistQuery = useQuery({
    queryKey: [...queryKeys.wishlist.all, identityId],
    queryFn: () => wishlistService.list(identityId),
  });

  const toggle = useMutation({
    mutationFn: (productId: string) => wishlistService.toggle(identityId, productId),
    onSuccess: ({ added }) => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.wishlist.all, identityId] });
      toast(added ? 'Added to wishlist' : 'Removed from wishlist', { icon: added ? '❤️' : '💔' });
    },
  });

  const remove = useMutation({
    mutationFn: (wishlistItemId: string) => wishlistService.remove(identityId, wishlistItemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...queryKeys.wishlist.all, identityId] }),
  });

  const items = wishlistQuery.data ?? [];
  const productIds = new Set(items.map((i) => i.product_id));

  return {
    items,
    isLoading: wishlistQuery.isLoading,
    isWishlisted: (productId: string) => productIds.has(productId),
    toggle: toggle.mutateAsync,
    remove: remove.mutateAsync,
  };
}
