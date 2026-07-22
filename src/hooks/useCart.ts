import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { cartService } from '@/services/cartService';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';

export function useCart() {
  const { identityId } = useAuth();
  const queryClient = useQueryClient();

  const cartQuery = useQuery({
    queryKey: [...queryKeys.cart.all, identityId],
    queryFn: () => cartService.list(identityId),
  });

  const savedForLaterQuery = useQuery({
    queryKey: [...queryKeys.cart.all, identityId, 'saved'],
    queryFn: () => cartService.savedForLater(identityId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [...queryKeys.cart.all, identityId] });
  };

  const addItem = useMutation({
    mutationFn: ({ productId, variantId, quantity }: { productId: string; variantId: string; quantity?: number }) =>
      cartService.addItem(identityId, productId, variantId, quantity),
    onSuccess: () => {
      invalidate();
      toast.success('Added to cart');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateQuantity = useMutation({
    mutationFn: ({ cartItemId, quantity }: { cartItemId: string; quantity: number }) => cartService.updateQuantity(identityId, cartItemId, quantity),
    onSuccess: invalidate,
  });

  const removeItem = useMutation({
    mutationFn: (cartItemId: string) => cartService.removeItem(identityId, cartItemId),
    onSuccess: () => {
      invalidate();
      toast('Item removed from cart', { icon: '🗑️' });
    },
  });

  const saveForLater = useMutation({
    mutationFn: ({ cartItemId, saved }: { cartItemId: string; saved: boolean }) => cartService.saveForLater(identityId, cartItemId, saved),
    onSuccess: invalidate,
  });

  const clearCart = useMutation({
    mutationFn: () => cartService.clear(identityId),
    onSuccess: invalidate,
  });

  const items = cartQuery.data ?? [];
  const subtotal = items.reduce((sum, item) => sum + (item.variant?.price_override ?? item.product?.price ?? 0) * item.quantity, 0);
  const totalMrp = items.reduce((sum, item) => sum + (item.product?.mrp ?? 0) * item.quantity, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items,
    savedForLater: savedForLaterQuery.data ?? [],
    isLoading: cartQuery.isLoading,
    subtotal,
    totalMrp,
    totalDiscount: Math.max(totalMrp - subtotal, 0),
    totalItems,
    addItem: addItem.mutateAsync,
    updateQuantity: updateQuantity.mutateAsync,
    removeItem: removeItem.mutateAsync,
    saveForLater: saveForLater.mutateAsync,
    clearCart: clearCart.mutateAsync,
  };
}
