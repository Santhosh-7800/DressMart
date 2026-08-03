import { addDoc, collection, doc, getDocs, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Payout } from '@/types';

const PAYOUTS_COLLECTION = 'payouts';

export interface CreatePayoutInput {
  seller_id: string;
  seller_name: string;
  amount: number;
  period_start: string;
  period_end: string;
  note: string | null;
  created_by: string;
}

/** Manually-recorded Head-Seller-to-seller payouts — no payment gateway automation, same spirit as
 *  the app's existing "informational only" bank-account fields on Profile. Head-Seller-only, per
 *  firestore.rules (a seller may read their own payout history but never write). */
export const payoutService = {
  async listAll(): Promise<Payout[]> {
    const snap = await getDocs(query(collection(db, PAYOUTS_COLLECTION), orderBy('created_at', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Payout);
  },

  async listForSeller(sellerId: string): Promise<Payout[]> {
    const snap = await getDocs(query(collection(db, PAYOUTS_COLLECTION), where('seller_id', '==', sellerId), orderBy('created_at', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Payout);
  },

  async create(input: CreatePayoutInput): Promise<Payout> {
    const now = new Date().toISOString();
    const payload = { ...input, status: 'pending' as const, created_at: now, paid_at: null, paid_by: null };
    const ref = await addDoc(collection(db, PAYOUTS_COLLECTION), payload);
    return { id: ref.id, ...payload };
  },

  async markAsPaid(payoutId: string, paidBy: string): Promise<void> {
    await updateDoc(doc(db, PAYOUTS_COLLECTION, payoutId), { status: 'paid', paid_at: new Date().toISOString(), paid_by: paidBy });
  },
};
