import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { SearchHistoryEntry, UserActivity } from '@/types';

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
const MAX_RECENT_SEARCHES = 20;

function normalizeQuery(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, ' ');
}

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

  /** Records (or bumps) a search — dedupes by normalized_query, so re-running the same search
   *  (regardless of casing/spacing) updates searched_at/result_count in place instead of piling up
   *  unlimited duplicate entries. `resultCount` defaults to 0 for commit sites that fire before any
   *  product query has resolved (see useSearch.ts's commitSearch) — SearchResultsPage patches in the
   *  real count once it's known, via updateSearchResultCount, at zero extra Firestore reads since
   *  that count comes from a query the page is already running for display. */
  async recordSearch(uid: string, term: string, resultCount = 0): Promise<void> {
    const trimmed = term.trim();
    if (!trimmed) return;
    const normalized_query = normalizeQuery(trimmed);
    const current = await getOrDefault(uid);
    const entry: SearchHistoryEntry = { query: trimmed, normalized_query, searched_at: new Date().toISOString(), result_count: resultCount };
    const recent_searches = [entry, ...current.recent_searches.filter((s) => s.normalized_query !== normalized_query)].slice(0, MAX_RECENT_SEARCHES);
    await setDoc(doc(db, 'user_activity', uid), { recent_searches, updated_at: new Date().toISOString() }, { merge: true });
  },

  /** Patches the result count of an already-recorded search (matched by normalized_query) without
   *  touching its position or searched_at — a no-op if that search has since fallen off the cap. */
  async updateSearchResultCount(uid: string, term: string, resultCount: number): Promise<void> {
    const normalized_query = normalizeQuery(term);
    const current = await getOrDefault(uid);
    if (!current.recent_searches.some((s) => s.normalized_query === normalized_query)) return;
    const recent_searches = current.recent_searches.map((s) => (s.normalized_query === normalized_query ? { ...s, result_count: resultCount } : s));
    await setDoc(doc(db, 'user_activity', uid), { recent_searches, updated_at: new Date().toISOString() }, { merge: true });
  },

  /** Folds a guest's local recent-searches (plain strings, no result count yet) into the now
   *  signed-in account's history — additive only, never overwrites an existing entry for the same
   *  normalized query, and never duplicates. One read-modify-write regardless of guest list size. */
  async mergeGuestSearches(uid: string, guestTerms: string[]): Promise<void> {
    if (guestTerms.length === 0) return;
    const current = await getOrDefault(uid);
    const existingNormalized = new Set(current.recent_searches.map((s) => s.normalized_query));
    const now = new Date().toISOString();
    const newEntries: SearchHistoryEntry[] = [];
    const seen = new Set<string>();
    guestTerms.forEach((term) => {
      const trimmed = term.trim();
      if (!trimmed) return;
      const normalized_query = normalizeQuery(trimmed);
      if (existingNormalized.has(normalized_query) || seen.has(normalized_query)) return;
      seen.add(normalized_query);
      newEntries.push({ query: trimmed, normalized_query, searched_at: now, result_count: 0 });
    });
    if (newEntries.length === 0) return;
    const recent_searches = [...current.recent_searches, ...newEntries].slice(0, MAX_RECENT_SEARCHES);
    await setDoc(doc(db, 'user_activity', uid), { recent_searches, updated_at: now }, { merge: true });
  },

  async clearRecentSearches(uid: string): Promise<void> {
    await setDoc(doc(db, 'user_activity', uid), { recent_searches: [], updated_at: new Date().toISOString() }, { merge: true });
  },
};
