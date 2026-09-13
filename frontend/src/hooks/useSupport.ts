import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supportService, type CreateTicketInput } from '@/services/supportService';
import { faqService } from '@/services/faqService';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import type { SupportMessage, SupportTicket } from '@/types';

/** A customer's own ticket list — realtime, same reasoning as useNotifications/useOrders. */
export function useMyTickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTickets(undefined);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsubscribe = supportService.subscribeToMyTickets(user.id, (data) => {
      setTickets(data);
      setIsLoading(false);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { data: tickets, isLoading };
}

export function useTicket(ticketId: string | undefined) {
  const [ticket, setTicket] = useState<SupportTicket | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!ticketId) {
      setTicket(undefined);
      return;
    }
    setIsLoading(true);
    const unsubscribe = supportService.subscribeToTicket(ticketId, (data) => {
      setTicket(data);
      setIsLoading(false);
    });
    return unsubscribe;
  }, [ticketId]);

  return { data: ticket, isLoading };
}

/** Customer-facing conversation — internal_note messages are excluded at the query level, not just
 *  by the UI (see supportService.subscribeToMessagesForCustomer's doc comment). */
export function useTicketMessages(ticketId: string | undefined) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!ticketId) {
      setMessages([]);
      return;
    }
    setIsLoading(true);
    const unsubscribe = supportService.subscribeToMessagesForCustomer(ticketId, (data) => {
      setMessages(data);
      setIsLoading(false);
    });
    return unsubscribe;
  }, [ticketId]);

  return { data: messages, isLoading };
}

export function useCreateTicket() {
  return useMutation({
    mutationFn: (input: CreateTicketInput) => supportService.createTicket(input),
  });
}

export function useSendCustomerReply(ticketId: string | undefined) {
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ ticket, message }: { ticket: SupportTicket; message: string }) => {
      if (!ticketId || !user) throw new Error('Not signed in.');
      return supportService.sendCustomerReply(ticketId, ticket, user.id, user.full_name, message);
    },
  });
}

/** Public Help Center content — falls back to lib/defaultFaqs.ts when the collection is empty (see
 *  that file's doc comment); that fallback decision is made by the caller (HelpCenterPage), not
 *  here, so this hook's data is always exactly what's in Firestore. */
export function useFaqs() {
  return useQuery({ queryKey: queryKeys.faqs.active, queryFn: () => faqService.list(), staleTime: 5 * 60 * 1000 });
}

export function useMarkTicketReadByCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ticketId: string) => supportService.markReadByCustomer(ticketId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
}
