import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { db } from '../lib/admin';
import { createNotification } from '../lib/notifications';
import type { SupportMessage, SupportTicket } from '../lib/types';

/** A ticket's very first message lands within moments of the ticket doc itself, and
 *  onSupportTicketCreated already notifies the Admin about that — this guards against
 *  sending a second, redundant "new request" notification for the same event (Section 24: "avoid
 *  duplicate notifications"). Anything further apart than this is treated as a genuine follow-up. */
const INITIAL_MESSAGE_WINDOW_MS = 10_000;

/**
 * Notifies whichever side didn't just send a message. `internal_note` messages never notify the
 * customer (they must never even learn one exists) and are skipped here entirely.
 */
export const onSupportMessageCreated = onDocumentCreated('supportTickets/{ticketId}/messages/{messageId}', async (event) => {
  const message = event.data?.data() as SupportMessage | undefined;
  if (!message || message.message_type === 'internal_note') return;

  const ticketId = event.params.ticketId;
  const ticketSnap = await db.collection('supportTickets').doc(ticketId).get();
  const ticket = ticketSnap.data() as SupportTicket | undefined;
  if (!ticket) return;

  if (message.message_type === 'customer_message') {
    const isInitialMessage = Math.abs(new Date(message.created_at).getTime() - new Date(ticket.created_at).getTime()) < INITIAL_MESSAGE_WINDOW_MS;
    if (isInitialMessage) return;

    const adminSnap = await db.collection('users').where('role', '==', 'admin').limit(1).get();
    if (adminSnap.empty) return;
    await createNotification({
      userId: adminSnap.docs[0].id,
      title: 'Customer replied to support request',
      message: `${ticket.user_name}: ${message.message.slice(0, 140)}`,
      type: 'support',
      link: `/admin/support/${ticketId}`,
    });
    return;
  }

  // owner_reply
  await createNotification({
    userId: ticket.user_id,
    title: 'DS LOOKS replied to your support request',
    message: ticket.subject,
    type: 'support',
    link: `/support/${ticketId}`,
  });
});
