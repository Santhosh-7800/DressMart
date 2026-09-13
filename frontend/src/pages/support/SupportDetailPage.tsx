import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LifeBuoy, Send, Package } from 'lucide-react';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTicket, useTicketMessages, useSendCustomerReply, useMarkTicketReadByCustomer } from '@/hooks/useSupport';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getFriendlyErrorMessage } from '@/lib/firebaseErrors';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting_for_customer: 'Waiting on You',
  resolved: 'Resolved',
  closed: 'Closed',
};

const CATEGORY_LABEL: Record<string, string> = {
  order: 'Orders',
  payment: 'Payments',
  delivery: 'Delivery',
  return: 'Returns',
  exchange: 'Exchanges',
  product: 'Products',
  coupon: 'Coupons',
  account: 'Account',
  other: 'Other',
};

/** Section 11/12/29: ticket meta + conversation + reply, with the "This request has been
 *  resolved"/closed empty states. Replying to a resolved ticket is still allowed (it reopens the
 *  ticket — see supportService.sendCustomerReply); only 'closed' disables the reply box entirely. */
export function SupportDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { data: ticket, isLoading } = useTicket(ticketId);
  const { data: messages } = useTicketMessages(ticketId);
  const sendReply = useSendCustomerReply(ticketId);
  const markRead = useMarkTicketReadByCustomer();
  const isOnline = useOnlineStatus();
  const [reply, setReply] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef<string | null>(null);

  useEffect(() => {
    if (ticketId && ticket?.customer_unread && markedRef.current !== ticketId) {
      markedRef.current = ticketId;
      markRead.mutate(ticketId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, ticket?.customer_unread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages?.length]);

  if (isLoading || ticket === undefined) {
    return (
      <div className="container-app space-y-4 py-8">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="container-app py-8 text-center text-sm text-primary-400">
        This support request could not be found.
      </div>
    );
  }

  const isClosed = ticket.status === 'closed';

  const handleSend = async () => {
    if (!isOnline) {
      toast.error('Unable to send your reply. Check your internet connection and try again.');
      return;
    }
    if (reply.trim().length < 10) {
      toast.error('Please write at least 10 characters.');
      return;
    }
    try {
      await sendReply.mutateAsync({ ticket, message: reply });
      setReply('');
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, "Couldn't send your reply. Please try again."));
    }
  };

  return (
    <div className="container-app max-w-2xl py-8">
      <Seo title={ticket.subject} />
      <div className="mb-4 flex items-center gap-2">
        <LifeBuoy size={18} className="text-accent" />
        <h1 className="truncate text-lg font-bold">{ticket.subject}</h1>
      </div>

      <div className="card-surface mb-5 space-y-2 p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-primary-400">Ticket ID</span>
          <span className="font-mono text-xs">{ticket.id}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-primary-400">Category</span>
          <span className="font-medium">{CATEGORY_LABEL[ticket.category]}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-primary-400">Status</span>
          <span className="font-medium">{STATUS_LABEL[ticket.status]}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-primary-400">Created</span>
          <span className="font-medium">{formatDateTime(ticket.created_at)}</span>
        </div>
        {ticket.order_id && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-primary-400">Order</span>
            <Link to={`/orders/${ticket.order_id}`} className="flex items-center gap-1 font-medium text-accent-600 hover:underline">
              <Package size={13} /> View Order
            </Link>
          </div>
        )}
      </div>

      <div className="card-surface mb-5 space-y-3 p-4">
        {(messages ?? []).map((m) => (
          <div key={m.id} className={cn('flex', m.sender_role === 'customer' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
                m.sender_role === 'customer' ? 'bg-accent-500 text-white' : 'bg-primary-50 dark:bg-primary-800',
              )}
            >
              <p className="whitespace-pre-wrap">{m.message}</p>
              <p className={cn('mt-1 text-[10px]', m.sender_role === 'customer' ? 'text-white/70' : 'text-primary-400')}>
                {m.sender_role === 'customer' ? 'You' : 'DS LOOKS'} · {formatDateTime(m.created_at)}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {isClosed ? (
        <div className="card-surface p-4 text-center text-sm text-primary-400">This request has been resolved and closed.</div>
      ) : (
        <div className="card-surface flex items-end gap-2 p-3">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Type your reply…"
            className="input-field flex-1 resize-none"
          />
          <Button variant="accent" onClick={handleSend} isLoading={sendReply.isPending} disabled={reply.trim().length < 10}>
            <Send size={15} />
          </Button>
        </div>
      )}
    </div>
  );
}
