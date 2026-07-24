import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { cartService, type CartLineItem } from '@/services/cartService';
import { useAuth } from '@/contexts/AuthContext';
import { getFriendlyErrorMessage } from '@/lib/firebaseErrors';

/** Cart requires a signed-in user (see Issue 2 spec) — there is no guest/localStorage cart.
 *  Realtime: reflects this tab's own writes, another tab, another device, or a stock change,
 *  with no manual refetch. */
export function useCart() {
  const { user, isAuthenticated } = useAuth();

  const [activeItems, setActiveItems] = useState<CartLineItem[] | undefined>(undefined);
  const [savedItems, setSavedItems] = useState<CartLineItem[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setActiveItems(undefined);
      setSavedItems(undefined);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsubActive = cartService.subscribeToCart(user.id, false, (items) => {
      setActiveItems(items);
      setIsLoading(false);
    });
    const unsubSaved = cartService.subscribeToCart(user.id, true, setSavedItems);
    return () => {
      unsubActive();
      unsubSaved();
    };
    // Intentionally keyed on user?.id, not the whole `user` object — AuthContext's profile is a
    // realtime subscription, so `user` gets a new reference on every unrelated field change (name,
    // avatar, phone...). Re-subscribing the cart listeners on every one of those would be wasted
    // Firestore reads/renders; only a genuine identity change should tear them down and reconnect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  const requireAuth = () => {
    if (!isAuthenticated || !user) throw new Error('Please sign in to manage your cart.');
    return user;
  };

  const addItem = useMutation({
    mutationFn: ({ productId, variantId, quantity }: { productId: string; variantId: string; quantity?: number }) => {
      const authedUser = requireAuth();
      return cartService.addItem(authedUser.id, productId, variantId, quantity);
    },
    onSuccess: () => toast.success('Added to cart'),
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error, error.message)),
  });

  const updateQuantity = useMutation({
    mutationFn: ({ cartItemId, quantity }: { cartItemId: string; quantity: number }) => cartService.updateQuantity(requireAuth().id, cartItemId, quantity),
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error, error.message)),
  });

  const removeItem = useMutation({
    mutationFn: (cartItemId: string) => cartService.removeItem(requireAuth().id, cartItemId),
    onSuccess: () => toast('Item removed from cart', { icon: '🗑️' }),
  });

  const saveForLater = useMutation({
    mutationFn: ({ cartItemId, saved }: { cartItemId: string; saved: boolean }) => cartService.saveForLater(requireAuth().id, cartItemId, saved),
  });

  const clearCart = useMutation({
    mutationFn: () => cartService.clear(requireAuth().id),
  });

  const items = activeItems ?? [];
  const subtotal = items.reduce((sum, item) => sum + (item.variant?.price_override ?? item.product?.price ?? item.price) * item.quantity, 0);
  const totalMrp = items.reduce((sum, item) => sum + (item.product?.mrp ?? item.price) * item.quantity, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const hasOutOfStockItems = items.some((item) => item.quantity > item.availableStock);

  return {
    items,
    savedForLater: savedItems ?? [],
    isLoading: isAuthenticated ? isLoading : false,
    subtotal,
    totalMrp,
    totalDiscount: Math.max(totalMrp - subtotal, 0),
    totalItems,
    hasOutOfStockItems,
    addItem: addItem.mutateAsync,
    updateQuantity: updateQuantity.mutateAsync,
    removeItem: removeItem.mutateAsync,
    saveForLater: saveForLater.mutateAsync,
    clearCart: clearCart.mutateAsync,
  };
}
