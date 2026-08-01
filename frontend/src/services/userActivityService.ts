import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserActivity } from '@/types';

/**
 * Firestore-backed personalization signals for a signed-in user — recently-viewed products,
 * browsed-category history, and recent searches, all in one `user_activity/{uid}` doc so they
 * roam across devices/browsers instead of living only in that one browser's localStorage (which
 * is what guests still use — see recentlyViewedService.ts/useCategoryHistory.ts/useSearch.ts's
 * guest branch). Each list is small and bounded, so a full read-modify-write per event is simpler
 * and cheaper than modeling them as subcollections.
 */
const MAX_RECENTLY_VIEWED = 12;
const MAX_CATEGORY_HISTORY = 20;
const MAX_RECENT_SEARCHES = 8;

const EMPTY_ACTIVITY: Omit<UserActivity, 'id' | 'updated_at'> = {
  recently_viewed: [],
  category_history: [],
  recent_searches: [],
};

async function getOrDefault(uid: string): Promise<UserActivity> {
  const snap = await getDoc(doc(db, 'user_activity', uid));
  const data = snap.exists() ? (snap.data() as Partial<UserActivity>) : undefined;
  return { id: uid, ...EMPTY_ACTIVITY, ...data, updated_at: data?.updated_at ?? new Date().toISOString() };
}

export const userActivityService = {
  async get(uid: string): Promise<UserActivity> {
    return getOrDefault(uid);
  },

  /** Records (or bumps) a product view — dedupes by product so re-viewing moves it back to the front. */
  async recordProductView(uid: string, productId: string): Promise<void> {
    const current = await getOrDefault(uid);
    const recently_viewed = [
      { product_id: productId, viewed_at: new Date().toISOString() },
      ...current.recently_viewed.filter((e) => e.product_id !== productId),
    ].slice(0, MAX_RECENTLY_VIEWED);
    await setDoc(doc(db, 'user_activity', uid), { recently_viewed, updated_at: new Date().toISOString() }, { merge: true });
  },

  async recordCategoryView(uid: string, categorySlug: string): Promise<void> {
    const current = await getOrDefault(uid);
    const category_history = [categorySlug, ...current.category_history.filter((slug) => slug !== categorySlug)].slice(0, MAX_CATEGORY_HISTORY);
    await setDoc(doc(db, 'user_activity', uid), { category_history, updated_at: new Date().toISOString() }, { merge: true });
  },

  async recordSearch(uid: string, term: string): Promise<void> {
    const trimmed = term.trim();
    if (!trimmed) return;
    const current = await getOrDefault(uid);
    const recent_searches = [trimmed, ...current.recent_searches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT_SEARCHES);
    await setDoc(doc(db, 'user_activity', uid), { recent_searches, updated_at: new Date().toISOString() }, { merge: true });
  },

  async clearRecentSearches(uid: string): Promise<void> {
    await setDoc(doc(db, 'user_activity', uid), { recent_searches: [], updated_at: new Date().toISOString() }, { merge: true });
  },
};
