import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { exchangeService, type RequestExchangeInput } from '@/services/exchangeService';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { isHeadSeller } from '@/lib/roles';
import type { ExchangeRequest, ExchangeStatus } from '@/types';

/** Buyer's own exchange requests — realtime, updates live as a seller approves/rejects/advances them. */
export function useExchanges() {
  const { user } = useAuth();
  const [exchanges, setExchanges] = useState<ExchangeRequest[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setExchanges(undefined);
      return;
    }
    setIsLoading(true);
    const unsubscribe = exchangeService.subscribeForBuyer(user.id, (data) => {
      setExchanges(data);
      setIsLoading(false);
    });
    return unsubscribe;
    // user?.id only, intentionally — see useCart.ts's identical note (AuthContext's user reference
    // changes on every profile field edit; only an actual identity change should resubscribe).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { data: exchanges, isLoading };
}

/** Seller / Head Seller's own exchange requests (or, for Head Seller, every request platform-wide). Realtime. */
export function useSellerExchanges() {
  const { user } = useAuth();
  const [exchanges, setExchanges] = useState<ExchangeRequest[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setExchanges(undefined);
      return;
    }
    setIsLoading(true);
    const unsubscribe = exchangeService.subscribeForSeller(user.id, isHeadSeller(user.role), (data) => {
      setExchanges(data);
      setIsLoading(false);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  return { data: exchanges, isLoading };
}

export function useRequestExchange() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RequestExchangeInput) => exchangeService.request(user!.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      toast.success('Exchange request submitted');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useAdvanceExchangeStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ exchangeRequest, nextStatus }: { exchangeRequest: ExchangeRequest; nextStatus: ExchangeStatus }) =>
      exchangeService.advanceStatus(exchangeRequest, nextStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      toast.success('Exchange updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
