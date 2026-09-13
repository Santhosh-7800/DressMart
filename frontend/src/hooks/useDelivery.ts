import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { orderService } from '@/services/orderService';
import { deliveryService } from '@/services/deliveryService';
import { deliveryAdminService } from '@/services/deliveryAdminService';
import { queryKeys } from '@/lib/queryClient';
import { getFriendlyErrorMessage } from '@/lib/firebaseErrors';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminRole } from '@/lib/roles';
import type { Order } from '@/types';

/**
 * Realtime — every order ever assigned to the signed-in delivery person. The dashboard groups this
 * single list into buckets (Assigned/Picked Up/Out for Delivery/Delivered/Failed) client-side.
 * `isError`/`retry` (Phase 17) surface a listener failure (permission or network) as a real error
 * state instead of leaving the dashboard silently stuck on stale data — `retry` re-subscribes by
 * bumping `retryNonce`, which is also what PullToRefresh's gesture triggers on this page.
 */
export function useDeliveryOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (!user) {
      setOrders(undefined);
      return;
    }
    setIsLoading(true);
    setIsError(false);
    const unsubscribe = orderService.subscribeForDeliveryStaff(
      user.id,
      (data) => {
        setOrders(data);
        setIsLoading(false);
        setIsError(false);
      },
      () => {
        setIsLoading(false);
        setIsError(true);
      },
    );
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, retryNonce]);

  return { data: orders, isLoading, isError, retry: () => setRetryNonce((n) => n + 1) };
}

/** Delivery-staff action mutations (accept/pickup/out-for-delivery/delivered/failed/note). Realtime
 *  listeners (useDeliveryOrders/useOrder) already reflect the write once the Cloud Function commits. */
export function useDeliveryAction() {
  return useMutation({
    mutationFn: async (
      input:
        | { orderId: string; action: 'accept' | 'picked_up' | 'out_for_delivery' | 'delivered' }
        | { orderId: string; action: 'failed'; reason: string }
        | { orderId: string; action: 'note'; note: string },
    ) => {
      switch (input.action) {
        case 'accept':
          return deliveryService.accept(input.orderId);
        case 'picked_up':
          return deliveryService.markPickedUp(input.orderId);
        case 'out_for_delivery':
          return deliveryService.markOutForDelivery(input.orderId);
        case 'delivered':
          return deliveryService.markDelivered(input.orderId);
        case 'failed':
          return deliveryService.markFailed(input.orderId, input.reason);
        case 'note':
          return deliveryService.addNote(input.orderId, input.note);
      }
    },
    onSuccess: (_data, input) => {
      const messages: Record<string, string> = {
        accept: 'Delivery accepted',
        picked_up: 'Marked as picked up',
        out_for_delivery: 'Marked as out for delivery',
        delivered: 'Marked as delivered',
        failed: 'Failed delivery reported',
        note: 'Note added',
      };
      toast.success(messages[input.action] ?? 'Updated');
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error)),
  });
}

// ---- Head Seller: Delivery Personnel management ----

/** Head-Seller-only — firestore.rules rejects this query for any other role (a regular seller
 *  isn't the owner of a delivery account's users/{uid} doc, so every result would be denied), so
 *  this is gated client-side too rather than firing a query guaranteed to fail. */
export function useDeliveryStaffRoster() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.delivery.roster(),
    queryFn: () => deliveryAdminService.listDeliveryStaff(),
    enabled: isAdminRole(user?.role),
  });
}

export function useAddDeliveryStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deliveryAdminService.addDeliveryStaff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.delivery.roster() });
      toast.success('Delivery person added — a password setup email has been sent.');
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error)),
  });
}

export function useRemoveDeliveryStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deliveryAdminService.removeDeliveryStaff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.delivery.roster() });
      toast.success('Delivery person removed');
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error)),
  });
}

export function useSetDeliveryStaffStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ deliveryStaffId, status, reason }: { deliveryStaffId: string; status: 'active' | 'inactive'; reason: string | null }) =>
      deliveryAdminService.setDeliveryStaffStatus(deliveryStaffId, status, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.delivery.roster() });
      toast.success('Status updated');
    },
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error)),
  });
}

export function useResetDeliveryStaffPassword() {
  return useMutation({
    mutationFn: deliveryAdminService.resetDeliveryStaffPassword,
    onSuccess: () => toast.success('Password reset email sent'),
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error)),
  });
}

export function useAssignDelivery() {
  return useMutation({
    mutationFn: ({ orderId, deliveryStaffId }: { orderId: string; deliveryStaffId: string }) =>
      deliveryAdminService.assignDelivery(orderId, deliveryStaffId),
    onSuccess: () => toast.success('Delivery assigned'),
    onError: (error: Error) => toast.error(getFriendlyErrorMessage(error)),
  });
}
