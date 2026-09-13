import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LifeBuoy, Send, Lock } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTicket } from '@/hooks/useSupport';
import { useTicketMessagesForOwner, useSendOwnerMessage, useUpdateTicket, useMarkTicketReadByOwner } from '@/hooks/useSupportAdmin';
import { getFriendlyErrorMessage } from '@/lib/firebaseErrors';
import { formatDateTime, cn } from '@/lib/utils';
import type { SupportTicketPriority, SupportTicketStatus } from '@/types';

const STATUS_OPTIONS: { value: SupportTicketStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_for_customer', label: 'Waiting on Customer' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const PRIORITY_OPTIONS: { value: SupportTicketPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
];

/** Section 11/17/18: full conversation (including internal notes, visually distinct and never sent
 *  to the customer), status/priority controls, and a reply box with an "Internal note" toggle. */
export function AdminSupportDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { data: ticket, isLoading } = useTicket(ticketId);
  const { data: messages } = useTicketMessagesForOwner(ticketId);
  const sendMessage = useSendOwnerMessage(ticketId);
  const updateTicket = useUpdateTicket(ticketId);
  const markRead = useMarkTicketReadByOwner();
  const [reply, setReply] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef<string | null>(null);

  useEffect(() => {
    if (ticketId && ticket?.admin_unread && markedRef.current !== ticketId) {
      markedRef.current = ticketId;
      markRead.mutate(ticketId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, ticket?.admin_unread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages?.length]);

  if (isLoading || ticket === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!ticket) {
    return <p className="text-sm text-acc-text-secondary">This support request could not be found.</p>;
  }

  const handleSend = async () => {
    const trimmed = reply.trim();
    if (trimmed.length < 1) return;
    try {
      await sendMessage.mutateAsync({ message: trimmed, messageType: isInternalNote ? 'internal_note' : 'owner_reply' });
      setReply('');
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, "Couldn't send. Please try again."));
    }
  };

  const handleStatusChange = async (status: SupportTicketStatus) => {
    try {
      await updateTicket.mutateAsync({ updates: { status }, currentStatus: ticket.status });
      toast.success('Status updated');
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, "Couldn't update status."));
    }
  };

  const handlePriorityChange = async (priority: SupportTicketPriority) => {
    try {
      await updateTicket.mutateAsync({ updates: { priority }, currentStatus: ticket.status });
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, "Couldn't update priority."));
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Seo title={ticket.subject} />
      <div className="flex items-center gap-2">
        <LifeBuoy size={18} className="text-acc-primary" />
        <h1 className="truncate text-lg font-bold text-acc-text dark:text-white">{ticket.subject}</h1>
      </div>

      <div className="card-surface grid grid-cols-1 gap-3 p-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-acc-text-secondary">Customer</p>
          <p className="font-medium">{ticket.user_name}</p>
        </div>
        <div>
          <p className="text-acc-text-secondary">Ticket ID</p>
          <p className="font-mono text-xs">{ticket.id}</p>
        </div>
        <div>
          <p className="mb-1 text-acc-text-secondary">Status</p>
          <select value={ticket.status} onChange={(e) => handleStatusChange(e.target.value as SupportTicketStatus)} className="input-field">
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="mb-1 text-acc-text-secondary">Priority</p>
          <select value={ticket.priority} onChange={(e) => handlePriorityChange(e.target.value as SupportTicketPriority)} className="input-field">
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        {ticket.order_id && (
          <div className="sm:col-span-2">
            <p className="text-acc-text-secondary">Related Order</p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-xs">{ticket.order_id}</p>
              <Link to="/admin/orders" className="text-xs font-medium text-acc-primary hover:underline">
                View in Orders
              </Link>
            </div>
          </div>
        )}
        <div className="sm:col-span-2">
          <p className="text-acc-text-secondary">Created</p>
          <p className="font-medium">{formatDateTime(ticket.created_at)}</p>
        </div>
      </div>

      <div className="card-surface space-y-3 p-4">
        {(messages ?? []).map((m) => (
          <div key={m.id} className={cn('flex', m.sender_role === 'admin' && m.message_type !== 'internal_note' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
                m.message_type === 'internal_note'
                  ? 'w-full border border-dashed border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                  : m.sender_role === 'admin'
                    ? 'bg-acc-primary text-white'
                    : 'bg-primary-50 dark:bg-primary-800',
              )}
            >
              {m.message_type === 'internal_note' && (
                <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  <Lock size={10} /> Internal Note — not visible to customer
                </p>
              )}
              <p className="whitespace-pre-wrap">{m.message}</p>
              <p className={cn('mt-1 text-[10px]', m.sender_role === 'admin' && m.message_type !== 'internal_note' ? 'text-white/70' : 'text-acc-text-secondary')}>
                {m.sender_role === 'customer' ? ticket.user_name : 'DS LOOKS'} · {formatDateTime(m.created_at)}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="card-surface space-y-2 p-3">
        <label className="flex items-center gap-2 text-xs font-medium text-acc-text-secondary">
          <input type="checkbox" checked={isInternalNote} onChange={(e) => setIsInternalNote(e.target.checked)} className="h-3.5 w-3.5 accent-amber-500" />
          Internal note (not visible to customer)
        </label>
        <div className="flex items-end gap-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder={isInternalNote ? 'Add a note for the team…' : 'Reply to the customer…'}
            className="input-field flex-1 resize-none"
          />
          <Button variant="account" onClick={handleSend} isLoading={sendMessage.isPending} disabled={reply.trim().length < 1}>
            <Send size={15} />
          </Button>
        </div>
      </div>
    </div>
  );
}
