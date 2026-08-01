import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { returnService } from '@/services/returnService';
import { queryKeys } from '@/lib/queryClient';
import { getFriendlyErrorMessage } from '@/lib/firebaseErrors';
import { useAuth } from '@/contexts/AuthContext';
import { effectiveSellerId, isHeadSeller } from '@/lib/roles';
import type { Order, ReturnRequest, ReturnStatus } from '@/types';

/** Buyer's own return requests — realtime, updates live as a seller approves/rejects/advances them. */
export function useReturns() {
  const { user } = useAuth();
  const [returns, setReturns] = useState<ReturnRequest[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setReturns(undefined);
      return;
    }
    setIsLoading(true);
    const unsubscribe = returnService.subscribeForBuyer(user.id, (data) => {
      setReturns(data);
      setIsLoading(false);
    });
    return unsubscribe;
    // user?.id only, intentionally — see useCart.ts's identical note (AuthContext's user reference
    // changes on every profile field edit; only an actual identity change should resubscribe).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { data: returns, isLoading };
}

/** Seller / Head Seller's own return requests (or, for Head Seller, every request platform-wide). Realtime. */
export function useSellerReturns() {
  const { user } = useAuth();
  const [returns, setReturns] = useState<ReturnRequest[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setReturns(undefined);
      return;
    }
    setIsLoading(true);
    const unsubscribe = returnService.subscribeForSeller(effectiveSellerId(user), isHeadSeller(user.role), (data) => {
      setReturns(data);
      setIsLoading(false);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  return { data: returns, isLoading };
}

export function useRequestReturn() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ order, orderItemId, reason, comment }: { order: Order; orderItemId: string; reason: string; comment: string }) =>
      returnService.request(user!.id, order, orderItemId, reason, comment),
    onSuccess: () => {
      // The returns list is realtime (useReturns) and picks this up on its own; only the plain
      // order-detail react-query cache (order.items[].return_status mirror) needs a nudge.
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      toast.success('Return request submitted');
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error)),
  });
}

export function useAdvanceReturnStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ returnRequest, nextStatus }: { returnRequest: ReturnRequest; nextStatus: ReturnStatus }) =>
      returnService.advanceStatus(returnRequest, nextStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      toast.success('Return updated');
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error)),
  });
}
