import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { orderService, type PlaceOrderInput } from '@/services/orderService';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';

export function useOrders() {
  const { identityId } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.orders.all, identityId],
    queryFn: () => orderService.list(identityId),
  });
}

export function useOrder(orderId: string | undefined) {
  const { identityId } = useAuth();
  return useQuery({
    queryKey: queryKeys.orders.detail(orderId ?? ''),
    queryFn: () => orderService.getById(identityId, orderId as string),
    enabled: Boolean(orderId),
    refetchInterval: 15000,
  });
}

export function usePlaceOrder() {
  const { identityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<PlaceOrderInput, 'userId'>) => orderService.placeOrder({ ...input, userId: identityId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.orders.all, identityId] });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.cart.all, identityId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useCancelOrder() {
  const { identityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) => orderService.cancel(identityId, orderId, reason),
    onSuccess: (updatedOrder) => {
      queryClient.setQueryData(queryKeys.orders.detail(updatedOrder.id), updatedOrder);
      queryClient.invalidateQueries({ queryKey: [...queryKeys.orders.all, identityId] });
      toast.success('Order cancelled');
    },
  });
}

export function useSimulateOrderProgress() {
  const { identityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => orderService.simulateProgress(identityId, orderId),
    onSuccess: (updatedOrder) => {
      queryClient.setQueryData(queryKeys.orders.detail(updatedOrder.id), updatedOrder);
      queryClient.invalidateQueries({ queryKey: [...queryKeys.orders.all, identityId] });
    },
  });
}
