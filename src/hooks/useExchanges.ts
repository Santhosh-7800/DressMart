import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { exchangeService, type RequestExchangeInput } from '@/services/exchangeService';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { isHeadSeller } from '@/lib/roles';
import type { ExchangeRequest, ExchangeStatus } from '@/types';

export function useExchanges() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.exchanges.all, user?.id],
    queryFn: () => exchangeService.listForBuyer(user!.id),
    enabled: Boolean(user),
  });
}

/** Seller / Head Seller's own exchange requests (or, for Head Seller, every request platform-wide). */
export function useSellerExchanges() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.exchanges.bySeller(user?.id ?? ''),
    queryFn: () => exchangeService.listForSeller(user!.id, isHeadSeller(user?.role)),
    enabled: Boolean(user),
  });
}

export function useRequestExchange() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RequestExchangeInput) => exchangeService.request(user!.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.exchanges.all, user?.id] });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      toast.success('Exchange request submitted');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useAdvanceExchangeStatus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ exchangeRequest, nextStatus }: { exchangeRequest: ExchangeRequest; nextStatus: ExchangeStatus }) =>
      exchangeService.advanceStatus(exchangeRequest, nextStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exchanges.bySeller(user?.id ?? '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      toast.success('Exchange updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
