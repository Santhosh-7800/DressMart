import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Faq } from '@/types';

const FAQS_COLLECTION = 'faqs';

export const faqService = {
  /** Public — active FAQs only, in display order. HelpCenterPage falls back to lib/defaultFaqs.ts
   *  when this comes back empty (a fresh install with no owner-authored content yet). */
  async list(): Promise<Faq[]> {
    const snap = await getDocs(query(collection(db, FAQS_COLLECTION), where('is_active', '==', true)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Faq).sort((a, b) => a.sort_order - b.sort_order);
  },

  /** Every FAQ regardless of active state — Head Seller's FAQ Management page. */
  async listAll(): Promise<Faq[]> {
    const snap = await getDocs(query(collection(db, FAQS_COLLECTION), orderBy('sort_order', 'asc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Faq);
  },

  async create(input: Omit<Faq, 'id' | 'created_at' | 'updated_at'>): Promise<Faq> {
    const ref = doc(collection(db, FAQS_COLLECTION));
    const now = new Date().toISOString();
    const payload = { ...input, created_at: now, updated_at: now };
    await setDoc(ref, payload);
    return { id: ref.id, ...payload };
  },

  async update(faqId: string, updates: Partial<Omit<Faq, 'id' | 'created_at'>>): Promise<void> {
    await updateDoc(doc(db, FAQS_COLLECTION, faqId), { ...updates, updated_at: new Date().toISOString() });
  },

  async remove(faqId: string): Promise<void> {
    await deleteDoc(doc(db, FAQS_COLLECTION, faqId));
  },

  /** Swaps sort_order with the adjacent FAQ in the given direction — the up/down reorder controls
   *  on the management page operate on the currently-displayed (already sort_order-ascending) list,
   *  so "the adjacent item" is just its neighbor in that array. */
  async swapOrder(current: Faq, neighbor: Faq): Promise<void> {
    const batchUpdates = [
      updateDoc(doc(db, FAQS_COLLECTION, current.id), { sort_order: neighbor.sort_order, updated_at: new Date().toISOString() }),
      updateDoc(doc(db, FAQS_COLLECTION, neighbor.id), { sort_order: current.sort_order, updated_at: new Date().toISOString() }),
    ];
    await Promise.all(batchUpdates);
  },
};
