import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { savedPaymentService } from '@/services/savedPaymentService';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import type { SavedPaymentMethod } from '@/types';

export function useSavedPayments() {
  const { identityId } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...queryKeys.savedPayments.all, identityId],
    queryFn: () => savedPaymentService.list(identityId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [...queryKeys.savedPayments.all, identityId] });

  const add = useMutation({
    mutationFn: (method: Omit<SavedPaymentMethod, 'id' | 'user_id'>) => savedPaymentService.add(identityId, method),
    onSuccess: () => {
      invalidate();
      toast.success('Payment method saved');
    },
  });

  const remove = useMutation({
    mutationFn: (methodId: string) => savedPaymentService.remove(identityId, methodId),
    onSuccess: invalidate,
  });

  return {
    methods: query.data ?? [],
    isLoading: query.isLoading,
    add: add.mutateAsync,
    remove: remove.mutateAsync,
  };
}
