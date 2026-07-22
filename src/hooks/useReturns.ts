import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { returnService } from '@/services/returnService';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import type { Order } from '@/types';

export function useReturns() {
  const { identityId } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.returns.all, identityId],
    queryFn: () => returnService.list(identityId),
  });
}

export function useRequestReturn() {
  const { identityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ order, orderItemId, reason, comment }: { order: Order; orderItemId: string; reason: string; comment: string }) =>
      returnService.request(identityId, order, orderItemId, reason, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.returns.all, identityId] });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.orders.all, identityId] });
      toast.success('Return request submitted');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSimulateReturnProgress() {
  const { identityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (returnId: string) => returnService.simulateProgress(identityId, returnId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.returns.all, identityId] });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.orders.all, identityId] });
    },
  });
}
