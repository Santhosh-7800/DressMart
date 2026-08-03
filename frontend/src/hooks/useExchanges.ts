import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { exchangeService, type RequestExchangeInput } from '@/services/exchangeService';
import { staffService } from '@/services/staffService';
import { queryKeys } from '@/lib/queryClient';
import { getFriendlyErrorMessage } from '@/lib/firebaseErrors';
import { useAuth } from '@/contexts/AuthContext';
import { isHeadSeller, isStaffRole } from '@/lib/roles';
import { EXCHANGE_STATUS_LABELS } from '@/lib/exchangeStatus';
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
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error)),
  });
}

export function useAdvanceExchangeStatus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ exchangeRequest, nextStatus }: { exchangeRequest: ExchangeRequest; nextStatus: ExchangeStatus }) =>
      exchangeService.advanceStatus(exchangeRequest, nextStatus),
    onSuccess: (_data, { exchangeRequest, nextStatus }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      toast.success('Exchange updated');
      if (user && isStaffRole(user.role)) {
        void staffService.logActivity({
          sellerId: exchangeRequest.seller_id,
          staffId: user.id,
          staffName: user.full_name,
          action: 'exchange_processed',
          targetType: 'exchange',
          targetId: exchangeRequest.id,
          targetLabel: EXCHANGE_STATUS_LABELS[nextStatus],
        });
      }
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error)),
  });
}
