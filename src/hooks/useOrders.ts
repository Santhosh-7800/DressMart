import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { orderService, type AdvanceStatusInput } from '@/services/orderService';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { isHeadSeller } from '@/lib/roles';
import type { Order } from '@/types';

/** Buyer's own orders — one card per seller-scoped shipment; group by order_number/group_id for display. */
export function useOrders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.orders.all, user?.id],
    queryFn: () => orderService.listForBuyer(user!.id),
    enabled: Boolean(user),
  });
}

export function useOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.orders.detail(orderId ?? ''),
    queryFn: () => orderService.getById(orderId as string),
    enabled: Boolean(orderId),
    refetchInterval: 15000,
  });
}

/** All Order docs sharing a checkout's group_id — a multi-seller cart splits into one doc per seller. */
export function useOrderGroup(groupId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['orders', 'group', groupId, user?.id],
    queryFn: () => orderService.listByGroup(user!.id, groupId as string),
    enabled: Boolean(groupId && user),
    refetchInterval: 15000,
  });
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

/** Seller / Head Seller's own orders (or, for Head Seller, every order platform-wide). */
export function useSellerOrders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.orders.bySeller(user?.id ?? ''),
    queryFn: () => orderService.listForSeller(user!.id, isHeadSeller(user?.role)),
    enabled: Boolean(user),
  });
}

export function useAdvanceOrderStatus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ order, input }: { order: Order; input: AdvanceStatusInput }) => orderService.advanceStatus(order, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.bySeller(user?.id ?? '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      toast.success('Order updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
