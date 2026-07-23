import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { returnService } from '@/services/returnService';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { isHeadSeller } from '@/lib/roles';
import type { Order, ReturnRequest, ReturnStatus } from '@/types';

export function useReturns() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.returns.all, user?.id],
    queryFn: () => returnService.listForBuyer(user!.id),
    enabled: Boolean(user),
  });
}

/** Seller / Head Seller's own return requests (or, for Head Seller, every request platform-wide). */
export function useSellerReturns() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.returns.bySeller(user?.id ?? ''),
    queryFn: () => returnService.listForSeller(user!.id, isHeadSeller(user?.role)),
    enabled: Boolean(user),
  });
}

export function useRequestReturn() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ order, orderItemId, reason, comment }: { order: Order; orderItemId: string; reason: string; comment: string }) =>
      returnService.request(user!.id, order, orderItemId, reason, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.returns.all, user?.id] });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      toast.success('Return request submitted');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useAdvanceReturnStatus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ returnRequest, nextStatus }: { returnRequest: ReturnRequest; nextStatus: ReturnStatus }) =>
      returnService.advanceStatus(returnRequest, nextStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.returns.bySeller(user?.id ?? '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      toast.success('Return updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
