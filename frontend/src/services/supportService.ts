import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { SupportCategory, SupportMessage, SupportMessageType, SupportTicket, SupportTicketPriority, SupportTicketStatus } from '@/types';

const TICKETS_COLLECTION = 'supportTickets';
const RATE_LIMITS_COLLECTION = 'support_rate_limits';
const MIN_SUBJECT_LENGTH = 5;
const MAX_SUBJECT_LENGTH = 100;
const MIN_MESSAGE_LENGTH = 10;
const MAX_MESSAGE_LENGTH = 2000;
const PREVIEW_LENGTH = 140;
/** Bounded window the owner dashboard fetches and filters/sorts client-side — same "bounded window
 *  + client-side filter" architecture as the product catalog (see productService.ts), appropriate
 *  at this app's realistic single-shop ticket volume and avoiding a composite index for every
 *  possible status/category/priority/search combination. */
const OWNER_WINDOW_LIMIT = 300;

function truncatePreview(message: string): string {
  return message.length > PREVIEW_LENGTH ? `${message.slice(0, PREVIEW_LENGTH)}…` : message;
}

function toTicket(d: { id: string; data: () => unknown }): SupportTicket {
  return { id: d.id, ...(d.data() as object) } as SupportTicket;
}
function toMessage(d: { id: string; data: () => unknown }): SupportMessage {
  return { id: d.id, ...(d.data() as object) } as SupportMessage;
}

export interface CreateTicketInput {
  userId: string;
  userName: string;
  subject: string;
  category: SupportCategory;
  message: string;
  orderId?: string | null;
  returnId?: string | null;
  exchangeId?: string | null;
}

export const supportService = {
  /**
   * A plain client writeBatch, not a Cloud Function — every check needed (subject/message length,
   * category enum, "this order/return/exchange actually belongs to me", the 2-minute cooldown) is
   * expressed directly in firestore.rules' supportTickets `allow create` and re-checked here only
   * for fast client-side feedback before a round-trip. A rules rejection from the cooldown surfaces
   * as a permission-denied error — callers should catch it and show a friendly "please wait a
   * moment" message rather than a raw Firebase error string.
   */
  async createTicket(input: CreateTicketInput): Promise<string> {
    const subject = input.subject.trim();
    const message = input.message.trim();
    if (subject.length < MIN_SUBJECT_LENGTH || subject.length > MAX_SUBJECT_LENGTH) {
      throw new Error(`Subject must be between ${MIN_SUBJECT_LENGTH} and ${MAX_SUBJECT_LENGTH} characters.`);
    }
    if (message.length < MIN_MESSAGE_LENGTH || message.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Message must be between ${MIN_MESSAGE_LENGTH} and ${MAX_MESSAGE_LENGTH} characters.`);
    }

    const ticketRef = doc(collection(db, TICKETS_COLLECTION));
    const messageRef = doc(collection(ticketRef, 'messages'));
    const rateLimitRef = doc(db, RATE_LIMITS_COLLECTION, input.userId);
    const now = new Date().toISOString();

    const batch = writeBatch(db);
    batch.set(ticketRef, {
      user_id: input.userId,
      user_name: input.userName,
      subject,
      category: input.category,
      status: 'open' satisfies SupportTicketStatus,
      priority: 'normal' satisfies SupportTicketPriority,
      order_id: input.orderId ?? null,
      return_id: input.returnId ?? null,
      exchange_id: input.exchangeId ?? null,
      assigned_to: null,
      created_at: now,
      updated_at: now,
      resolved_at: null,
      last_message_at: now,
      last_message_by: 'customer',
      last_message_preview: truncatePreview(message),
      admin_unread: true,
      customer_unread: false,
    });
    batch.set(messageRef, {
      ticket_id: ticketRef.id,
      sender_id: input.userId,
      sender_name: input.userName,
      sender_role: 'customer',
      message_type: 'customer_message' satisfies SupportMessageType,
      message,
      created_at: now,
    });
    batch.set(rateLimitRef, { last_ticket_at: serverTimestamp() });
    await batch.commit();

    return ticketRef.id;
  },

  async getTicket(ticketId: string): Promise<SupportTicket | null> {
    const snap = await getDoc(doc(db, TICKETS_COLLECTION, ticketId));
    return snap.exists() ? toTicket(snap) : null;
  },

  subscribeToTicket(ticketId: string, callback: (ticket: SupportTicket | null) => void): Unsubscribe {
    return onSnapshot(doc(db, TICKETS_COLLECTION, ticketId), (snap) => callback(snap.exists() ? toTicket(snap) : null));
  },

  /** A customer's own ticket list — realistically small and bounded per user, same reasoning as
   *  notificationService.subscribe, so a live listener is cheap here. */
  subscribeToMyTickets(userId: string, callback: (tickets: SupportTicket[]) => void): Unsubscribe {
    const q = query(collection(db, TICKETS_COLLECTION), where('user_id', '==', userId), orderBy('created_at', 'desc'));
    return onSnapshot(q, (snap) => callback(snap.docs.map(toTicket)));
  },

  /** Customer-facing message list — ALWAYS filtered to exclude internal_note in the query itself
   *  (see SupportMessage's doc comment: a list query is rejected outright if any matched doc would
   *  fail the read rule, so the filter has to live here, not just in firestore.rules). */
  subscribeToMessagesForCustomer(ticketId: string, callback: (messages: SupportMessage[]) => void): Unsubscribe {
    const q = query(
      collection(db, TICKETS_COLLECTION, ticketId, 'messages'),
      where('message_type', 'in', ['customer_message', 'owner_reply']),
      orderBy('created_at', 'asc'),
    );
    return onSnapshot(q, (snap) => callback(snap.docs.map(toMessage)));
  },

  /** Owner-facing — sees every message including internal notes; the UI is responsible for never
   *  rendering an internal_note in a context the customer could see. */
  subscribeToMessagesForOwner(ticketId: string, callback: (messages: SupportMessage[]) => void): Unsubscribe {
    const q = query(collection(db, TICKETS_COLLECTION, ticketId, 'messages'), orderBy('created_at', 'asc'));
    return onSnapshot(q, (snap) => callback(snap.docs.map(toMessage)));
  },

  /** Customer's own follow-up reply — blocked by firestore.rules once the ticket is 'closed'. A
   *  reply to a 'waiting_for_customer' or 'resolved' ticket reopens it to 'in_progress'. */
  async sendCustomerReply(ticketId: string, ticket: SupportTicket, senderId: string, senderName: string, message: string): Promise<void> {
    const trimmed = message.trim();
    if (trimmed.length < MIN_MESSAGE_LENGTH || trimmed.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Message must be between ${MIN_MESSAGE_LENGTH} and ${MAX_MESSAGE_LENGTH} characters.`);
    }
    const now = new Date().toISOString();
    const messageRef = doc(collection(db, TICKETS_COLLECTION, ticketId, 'messages'));
    const nextStatus: SupportTicketStatus = ticket.status === 'waiting_for_customer' || ticket.status === 'resolved' ? 'in_progress' : ticket.status;

    const batch = writeBatch(db);
    batch.set(messageRef, {
      ticket_id: ticketId,
      sender_id: senderId,
      sender_name: senderName,
      sender_role: 'customer',
      message_type: 'customer_message' satisfies SupportMessageType,
      message: trimmed,
      created_at: now,
    });
    batch.update(doc(db, TICKETS_COLLECTION, ticketId), {
      last_message_at: now,
      last_message_by: 'customer',
      last_message_preview: truncatePreview(trimmed),
      admin_unread: true,
      customer_unread: false,
      updated_at: now,
      status: nextStatus,
    });
    await batch.commit();
  },

  /** Marks the customer's own unread flag false — call when the ticket detail page is opened. */
  async markReadByCustomer(ticketId: string): Promise<void> {
    await updateDoc(doc(db, TICKETS_COLLECTION, ticketId), { customer_unread: false });
  },

  // ---- Head Seller / owner-facing ----

  /** Bounded recent window (see OWNER_WINDOW_LIMIT) — status/category/priority/search filtering all
   *  happen client-side over this window, mirroring productService.ts's list() architecture. */
  subscribeAllTicketsForOwner(callback: (tickets: SupportTicket[]) => void): Unsubscribe {
    const q = query(collection(db, TICKETS_COLLECTION), orderBy('created_at', 'desc'), limit(OWNER_WINDOW_LIMIT));
    return onSnapshot(q, (snap) => callback(snap.docs.map(toTicket)));
  },

  /** Owner reply or internal note. Internal notes deliberately never touch the ticket doc's
   *  customer-visible fields (last_message_at / last_message_preview / customer_unread) — the
   *  customer must never learn one was posted, not even indirectly via a bumped "last updated"
   *  preview. */
  async sendOwnerMessage(ticketId: string, senderId: string, senderName: string, message: string, messageType: 'owner_reply' | 'internal_note'): Promise<void> {
    const trimmed = message.trim();
    if (trimmed.length < 1 || trimmed.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
    }
    const now = new Date().toISOString();
    const messageRef = doc(collection(db, TICKETS_COLLECTION, ticketId, 'messages'));

    const batch = writeBatch(db);
    batch.set(messageRef, {
      ticket_id: ticketId,
      sender_id: senderId,
      sender_name: senderName,
      sender_role: 'admin',
      message_type: messageType,
      message: trimmed,
      created_at: now,
    });
    if (messageType === 'owner_reply') {
      batch.update(doc(db, TICKETS_COLLECTION, ticketId), {
        last_message_at: now,
        last_message_by: 'admin',
        last_message_preview: truncatePreview(trimmed),
        customer_unread: true,
        admin_unread: false,
        updated_at: now,
      });
    }
    await batch.commit();
  },

  async updateTicket(
    ticketId: string,
    updates: Partial<Pick<SupportTicket, 'status' | 'priority' | 'assigned_to'>>,
    currentStatus: SupportTicketStatus,
  ): Promise<void> {
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = { ...updates, updated_at: now };
    if (updates.status && updates.status !== currentStatus) {
      payload.resolved_at = updates.status === 'resolved' ? now : null;
    }
    await updateDoc(doc(db, TICKETS_COLLECTION, ticketId), payload);
  },

  async markReadByOwner(ticketId: string): Promise<void> {
    await updateDoc(doc(db, TICKETS_COLLECTION, ticketId), { admin_unread: false });
  },
};
