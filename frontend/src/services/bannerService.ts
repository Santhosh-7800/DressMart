import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Banner } from '@/types';

const BANNERS_COLLECTION = 'banners';

export const bannerService = {
  /** Buyer-facing, public-read — active banners for the homepage carousel, sorted for display. */
  async list(): Promise<Banner[]> {
    const snap = await getDocs(query(collection(db, BANNERS_COLLECTION), where('is_active', '==', true)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Banner).sort((a, b) => a.sort_order - b.sort_order);
  },

  /** Every banner regardless of active state — Head Seller's Banner Management page. */
  async listAll(): Promise<Banner[]> {
    const snap = await getDocs(query(collection(db, BANNERS_COLLECTION), orderBy('sort_order', 'asc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Banner);
  },

  async create(input: Omit<Banner, 'id' | 'created_at'>): Promise<Banner> {
    const ref = doc(collection(db, BANNERS_COLLECTION));
    const payload = { ...input, created_at: new Date().toISOString() };
    await setDoc(ref, payload);
    return { id: ref.id, ...payload };
  },

  async update(bannerId: string, updates: Partial<Omit<Banner, 'id' | 'created_at'>>): Promise<void> {
    await updateDoc(doc(db, BANNERS_COLLECTION, bannerId), updates);
  },

  async remove(bannerId: string): Promise<void> {
    await deleteDoc(doc(db, BANNERS_COLLECTION, bannerId));
  },
};
