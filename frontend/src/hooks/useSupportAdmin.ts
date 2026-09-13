import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supportService } from '@/services/supportService';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import type { SupportMessage, SupportTicket, SupportTicketStatus } from '@/types';

/** Bounded, realtime window of recent tickets (see supportService's OWNER_WINDOW_LIMIT) — the Head
 *  Seller dashboard's stats/search/filters (Sections 14-16) all derive from this same fetch via
 *  lib/supportFilters.ts, rather than issuing a separate Firestore query per filter combination. */
export function useAllTicketsForOwner() {
  const [tickets, setTickets] = useState<SupportTicket[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = supportService.subscribeAllTicketsForOwner((data) => {
      setTickets(data);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  return { data: tickets, isLoading };
}

/** Nav badge count — a separate listener from useAllTicketsForOwner's, same duplicate-listener
 *  tradeoff useNotifications already accepts for its own nav badge (see SellerLayout's
 *  NotificationNavBadge), simple and cheap enough at this app's realistic ticket volume. */
export function useUnreadSupportCount() {
  const { data: tickets } = useAllTicketsForOwner();
  return (tickets ?? []).filter((t) => t.admin_unread).length;
}

export function useTicketMessagesForOwner(ticketId: string | undefined) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!ticketId) {
      setMessages([]);
      return;
    }
    setIsLoading(true);
    const unsubscribe = supportService.subscribeToMessagesForOwner(ticketId, (data) => {
      setMessages(data);
      setIsLoading(false);
    });
    return unsubscribe;
  }, [ticketId]);

  return { data: messages, isLoading };
}

export function useSendOwnerMessage(ticketId: string | undefined) {
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ message, messageType }: { message: string; messageType: 'owner_reply' | 'internal_note' }) => {
      if (!ticketId || !user) throw new Error('Not signed in.');
      return supportService.sendOwnerMessage(ticketId, user.id, user.full_name, message, messageType);
    },
  });
}

export function useUpdateTicket(ticketId: string | undefined) {
  return useMutation({
    mutationFn: ({
      updates,
      currentStatus,
    }: {
      updates: Partial<Pick<SupportTicket, 'status' | 'priority' | 'assigned_to'>>;
      currentStatus: SupportTicketStatus;
    }) => {
      if (!ticketId) throw new Error('No ticket selected.');
      return supportService.updateTicket(ticketId, updates, currentStatus);
    },
  });
}

export function useMarkTicketReadByOwner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ticketId: string) => supportService.markReadByOwner(ticketId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
}
