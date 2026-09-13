import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Banner } from '@/types';

const BANNERS_COLLECTION = 'banners';

function isCurrentlyScheduled(banner: Banner, now = new Date()): boolean {
  if (banner.start_at && now < new Date(banner.start_at)) return false;
  if (banner.end_at && now > new Date(banner.end_at)) return false;
  return true;
}

export const bannerService = {
  /** Buyer-facing, public-read — active AND currently-scheduled banners for the homepage carousel,
   *  sorted for display. is_active alone predates scheduling (Phase 13); a banner outside its
   *  [start_at, end_at] window is filtered out here since Firestore can't express "now between two
   *  fields" as a query constraint (same reasoning as couponService's isCurrentlyValid). */
  async list(): Promise<Banner[]> {
    const snap = await getDocs(query(collection(db, BANNERS_COLLECTION), where('is_active', '==', true)));
    const banners = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Banner);
    const now = new Date();
    return banners.filter((b) => isCurrentlyScheduled(b, now)).sort((a, b) => a.sort_order - b.sort_order);
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
