import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { orderService, type AdvanceStatusInput } from '@/services/orderService';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { isHeadSeller } from '@/lib/roles';
import type { Order } from '@/types';

/** Buyer's own orders — one card per seller-scoped shipment; group by order_number/group_id for
 *  display. Realtime: updates live as a seller advances status, no polling/refresh needed. */
export function useOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setOrders(undefined);
      return;
    }
    setIsLoading(true);
    const unsubscribe = orderService.subscribeForBuyer(user.id, (data) => {
      setOrders(data);
      setIsLoading(false);
    });
    return unsubscribe;
    // user?.id only, intentionally — see useCart.ts's identical note (AuthContext's user reference
    // changes on every profile field edit; only an actual identity change should resubscribe).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { data: orders, isLoading };
}

/** Realtime single order — tracking/detail pages update live instead of polling. */
export function useOrder(orderId: string | undefined) {
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setOrder(undefined);
      return;
    }
    setIsLoading(true);
    const unsubscribe = orderService.subscribeToOrder(orderId, (data) => {
      setOrder(data);
      setIsLoading(false);
    });
    return unsubscribe;
  }, [orderId]);

  return { data: order, isLoading };
}

/** All Order docs sharing a checkout's group_id — a multi-seller cart splits into one doc per seller. Realtime. */
export function useOrderGroup(groupId: string | undefined) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!groupId || !user) {
      setOrders(undefined);
      return;
    }
    setIsLoading(true);
    const unsubscribe = orderService.subscribeToOrderGroup(user.id, groupId, (data) => {
      setOrders(data);
      setIsLoading(false);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, user?.id]);

  return { data: orders, isLoading };
}

export function useOrdersByNumber(orderNumber: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['orders', 'number', orderNumber, user?.id],
    queryFn: () => orderService.listByOrderNumber(user!.id, orderNumber as string),
    enabled: Boolean(orderNumber && user),
  });
}

export function useCancelOrder() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => orderService.cancel(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.orders.all, user?.id] });
      toast.success('Order cancelled');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Seller / Head Seller's own orders (or, for Head Seller, every order platform-wide). Realtime. */
export function useSellerOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setOrders(undefined);
      return;
    }
    setIsLoading(true);
    const unsubscribe = orderService.subscribeForSeller(user.id, isHeadSeller(user.role), (data) => {
      setOrders(data);
      setIsLoading(false);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  return { data: orders, isLoading };
}

export function useAdvanceOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ order, input }: { order: Order; input: AdvanceStatusInput }) => orderService.advanceStatus(order, input),
    onSuccess: () => {
      // Realtime listeners (useOrders/useSellerOrders) already reflect this write — invalidate
      // only the plain react-query caches that don't have a live listener (e.g. by-order-number lookups).
      queryClient.invalidateQueries({ queryKey: ['orders', 'number'] });
      toast.success('Order updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
