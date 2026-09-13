import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { db } from '../lib/admin';
import { createNotification } from '../lib/notifications';
import type { SupportTicket } from '../lib/types';

/**
 * Notifies the Admin of a brand-new support ticket. The ticket doc itself is created by a
 * direct, rules-gated client write (see firestore.rules' supportTickets `allow create`), not a
 * callable — this trigger is the only server-side involvement in ticket creation, and exists
 * purely for the notification fan-out (same reason every other "new X" notification in this app is
 * trigger-based: onReviewWritten). Like those, it needs the project on the Blaze plan to actually
 * deploy.
 */
export const onSupportTicketCreated = onDocumentCreated('supportTickets/{ticketId}', async (event) => {
  const ticket = event.data?.data() as SupportTicket | undefined;
  if (!ticket) return;

  const adminSnap = await db.collection('users').where('role', '==', 'admin').limit(1).get();
  if (adminSnap.empty) return;
  const admin = adminSnap.docs[0];

  await createNotification({
    userId: admin.id,
    title: 'New customer support request',
    message: `${ticket.user_name}: ${ticket.subject}`,
    type: 'support',
    link: `/admin/support/${event.params.ticketId}`,
  });
});
