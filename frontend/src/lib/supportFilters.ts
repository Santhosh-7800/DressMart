import type { SupportCategory, SupportTicket, SupportTicketPriority, SupportTicketStatus } from '@/types';

export interface SupportTicketFilters {
  status?: SupportTicketStatus | 'all';
  category?: SupportCategory | 'all';
  priority?: SupportTicketPriority | 'all';
  /** Matched against ticket id, order_id, subject, and customer name — same "bounded window +
   *  client-side filter" approach as the product catalog (see productService.ts), appropriate since
   *  Firestore can't substring-search subject/order id server-side. */
  search?: string;
}

/** Pure so the owner dashboard's stat cards (Section 14) and the filtered list (Section 15/16) can
 *  both derive from the same already-fetched bounded window without re-querying Firestore. */
export function filterTickets(tickets: SupportTicket[], filters: SupportTicketFilters): SupportTicket[] {
  const term = filters.search?.trim().toLowerCase();
  return tickets.filter((t) => {
    if (filters.status && filters.status !== 'all' && t.status !== filters.status) return false;
    if (filters.category && filters.category !== 'all' && t.category !== filters.category) return false;
    if (filters.priority && filters.priority !== 'all' && t.priority !== filters.priority) return false;
    if (term) {
      const haystack = `${t.id} ${t.order_id ?? ''} ${t.subject} ${t.user_name}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
}

export interface SupportTicketStats {
  open: number;
  inProgress: number;
  waiting: number;
  resolved: number;
  highPriority: number;
  newToday: number;
}

export function computeSupportStats(tickets: SupportTicket[]): SupportTicketStats {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return {
    open: tickets.filter((t) => t.status === 'open').length,
    inProgress: tickets.filter((t) => t.status === 'in_progress').length,
    waiting: tickets.filter((t) => t.status === 'waiting_for_customer').length,
    resolved: tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length,
    highPriority: tickets.filter((t) => t.priority === 'high' && t.status !== 'resolved' && t.status !== 'closed').length,
    newToday: tickets.filter((t) => new Date(t.created_at) >= todayStart).length,
  };
}
