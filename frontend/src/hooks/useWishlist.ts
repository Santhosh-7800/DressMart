import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { wishlistService } from '@/services/wishlistService';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Wishlist for both guests and signed-in users. Guests get a localStorage-backed list (Firestore's
 * `wishlist` collection requires a signed-in owner — see firestore.rules); the moment a guest signs
 * in, their local items are folded into the account's Firestore wishlist and local storage is
 * cleared, so a browse-then-sign-in flow never loses what was saved before login.
 */
export function useWishlist() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const hasMergedRef = useRef(false);

  const queryKey = [...queryKeys.wishlist.all, isAuthenticated ? user!.id : 'guest'];

  const wishlistQuery = useQuery({
    queryKey,
    queryFn: () => (isAuthenticated ? wishlistService.list(user!.id) : wishlistService.listGuest()),
  });

  useEffect(() => {
    if (!isAuthenticated || !user || hasMergedRef.current) return;
    hasMergedRef.current = true;
    wishlistService.mergeGuestIntoAccount(user.id).then(() => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.wishlist.all, user.id] });
    });
  }, [isAuthenticated, user, queryClient]);

  const toggle = useMutation({
    mutationFn: (productId: string) => (isAuthenticated ? wishlistService.toggle(user!.id, productId) : Promise.resolve(wishlistService.toggleGuest(productId))),
    onSuccess: ({ added }) => {
      queryClient.invalidateQueries({ queryKey });
      toast(added ? 'Added to wishlist' : 'Removed from wishlist', { icon: added ? '❤️' : '💔' });
    },
  });

  const remove = useMutation({
    mutationFn: async (wishlistItemIdOrProductId: string) => {
      if (isAuthenticated) {
        await wishlistService.remove(user!.id, wishlistItemIdOrProductId);
      } else {
        wishlistService.removeGuest(wishlistItemIdOrProductId);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const items = wishlistQuery.data ?? [];
  const productIds = new Set(items.map((i) => i.product_id));

  // Guards against a rapid double-click firing a second, redundant toggle before the first one's
  // round-trip finishes — the button gives no visual "in progress" feedback, so a slow-feeling
  // click otherwise invites an extra tap, which just queues up more of the same latency.
  const toggleOnce = (productId: string) => (toggle.isPending ? Promise.resolve(undefined) : toggle.mutateAsync(productId));

  return {
    items,
    isLoading: wishlistQuery.isLoading,
    isWishlisted: (productId: string) => productIds.has(productId),
    toggle: toggleOnce,
    remove: remove.mutateAsync,
  };
}
