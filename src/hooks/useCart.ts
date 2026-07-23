import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { cartService, type CartLineItem } from '@/services/cartService';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';

export function useCart() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const scopeKey = user?.id ?? 'guest';
  const hasMergedRef = useRef(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [...queryKeys.cart.all, scopeKey] });
  };

  // Merge any localStorage guest-cart items into the account's Firestore cart, once per login.
  useEffect(() => {
    if (isAuthenticated && user && !hasMergedRef.current) {
      hasMergedRef.current = true;
      cartService.mergeGuestCartIntoAccount(user.id).then((merged) => {
        if (merged) invalidate();
      });
    }
    if (!isAuthenticated) hasMergedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  // Signed-in cart is realtime (Firestore listener) — reflects this tab's own writes, another
  // tab/device, or a stock change, with no manual refetch. Guests have no Firestore doc to listen
  // to (localStorage only), so they keep the one-shot query below.
  const [liveActive, setLiveActive] = useState<CartLineItem[] | null>(null);
  const [liveSaved, setLiveSaved] = useState<CartLineItem[] | null>(null);
  const [isLiveLoading, setIsLiveLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setLiveActive(null);
      setLiveSaved(null);
      return;
    }
    setIsLiveLoading(true);
    const unsubActive = cartService.subscribeToCart(user.id, false, (items) => {
      setLiveActive(items);
      setIsLiveLoading(false);
    });
    const unsubSaved = cartService.subscribeToCart(user.id, true, setLiveSaved);
    return () => {
      unsubActive();
      unsubSaved();
    };
  }, [isAuthenticated, user?.id]);

  const guestCartQuery = useQuery({
    queryKey: [...queryKeys.cart.all, scopeKey, 'active'],
    queryFn: () => cartService.listGuest(),
    enabled: !isAuthenticated,
  });

  const guestSavedQuery = useQuery({
    queryKey: [...queryKeys.cart.all, scopeKey, 'saved'],
    queryFn: () => cartService.savedForLaterGuest(),
    enabled: !isAuthenticated,
  });

  const addItem = useMutation({
    mutationFn: ({ productId, variantId, quantity }: { productId: string; variantId: string; quantity?: number }) =>
      isAuthenticated && user ? cartService.addItem(user.id, productId, variantId, quantity) : cartService.addItemGuest(productId, variantId, quantity),
    onSuccess: () => {
      invalidate();
      toast.success('Added to cart');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateQuantity = useMutation({
    mutationFn: ({ cartItemId, quantity }: { cartItemId: string; quantity: number }) =>
      isAuthenticated && user ? cartService.updateQuantity(user.id, cartItemId, quantity) : cartService.updateQuantityGuest(cartItemId, quantity),
    onSuccess: invalidate,
  });

  const removeItem = useMutation({
    mutationFn: (cartItemId: string) => (isAuthenticated && user ? cartService.removeItem(user.id, cartItemId) : cartService.removeItemGuest(cartItemId)),
    onSuccess: () => {
      invalidate();
      toast('Item removed from cart', { icon: '🗑️' });
    },
  });

  const saveForLater = useMutation({
    mutationFn: ({ cartItemId, saved }: { cartItemId: string; saved: boolean }) =>
      isAuthenticated && user ? cartService.saveForLater(user.id, cartItemId, saved) : cartService.saveForLaterGuest(cartItemId, saved),
    onSuccess: invalidate,
  });

  const clearCart = useMutation({
    mutationFn: () => (isAuthenticated && user ? cartService.clear(user.id) : cartService.clearGuest()),
    onSuccess: invalidate,
  });

  const items = (isAuthenticated ? liveActive : guestCartQuery.data) ?? [];
  const subtotal = items.reduce((sum, item) => sum + (item.variant?.price_override ?? item.product?.price ?? 0) * item.quantity, 0);
  const totalMrp = items.reduce((sum, item) => sum + (item.product?.mrp ?? 0) * item.quantity, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const hasOutOfStockItems = items.some((item) => item.quantity > item.availableStock);

  return {
    items,
    savedForLater: (isAuthenticated ? liveSaved : guestSavedQuery.data) ?? [],
    isLoading: isAuthenticated ? isLiveLoading : guestCartQuery.isLoading,
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
