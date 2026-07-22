import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { adminDataService } from '@/services/adminDataService';
import { orderService } from '@/services/orderService';
import { returnService } from '@/services/returnService';
import type { OrderStatus } from '@/types';

export function useAdminOrders() {
  return useQuery({ queryKey: ['admin', 'orders'], queryFn: () => adminDataService.getAllOrders() });
}

export function useAdminReturns() {
  return useQuery({ queryKey: ['admin', 'returns'], queryFn: () => adminDataService.getAllReturns() });
}

export function useSetOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, orderId, status }: { userId: string; orderId: string; status: OrderStatus }) => orderService.setStatus(userId, orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      toast.success('Order status updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useAdvanceReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, returnId }: { userId: string; returnId: string }) => returnService.simulateProgress(userId, returnId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'returns'] });
      toast.success('Return updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
