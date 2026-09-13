import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { createNotificationOnce } from '../lib/notifications';
import type { SupportTicket, SupportTicketStatus } from '../lib/types';

const STATUS_LABEL: Record<SupportTicketStatus, string> = {
  open: 'reopened',
  in_progress: 'being worked on',
  waiting_for_customer: 'waiting on your response',
  resolved: 'resolved',
  closed: 'closed',
};

/** Notifies the customer only for status changes the Admin makes directly (resolved/closed/
 *  waiting_for_customer/reopened-to-open) — the "customer replied, reopening from waiting/resolved
 *  to in_progress" transition is the customer's own action reflecting back at them, not news, so
 *  it's deliberately excluded here to avoid notifying someone about their own message. */
const NOTIFY_ON: SupportTicketStatus[] = ['waiting_for_customer', 'resolved', 'closed'];

export const onSupportTicketStatusChange = onDocumentUpdated('supportTickets/{ticketId}', async (event) => {
  const before = event.data?.before.data() as SupportTicket | undefined;
  const after = event.data?.after.data() as SupportTicket | undefined;
  if (!before || !after || before.status === after.status) return;
  if (!NOTIFY_ON.includes(after.status)) return;

  await createNotificationOnce(`support_ticket:${event.params.ticketId}:${after.status}`, {
    userId: after.user_id,
    title: 'Support request update',
    message: `Your support request "${after.subject}" has been ${STATUS_LABEL[after.status]}.`,
    type: 'support',
    link: `/support/${event.params.ticketId}`,
  });
});
