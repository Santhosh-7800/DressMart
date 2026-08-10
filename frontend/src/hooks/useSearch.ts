import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from './useDebounce';
import { useLocalStorage } from './useLocalStorage';
import { productService, categoryService, brandService } from '@/services/productService';
import { userActivityService } from '@/services/userActivityService';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import type { SearchHistoryEntry } from '@/types';

const POPULAR_SEARCHES = ['Formal Shirts', 'Jeans', 'Hoodies', 'Kids T-Shirts', 'Jackets', 'Polo T-Shirts', 'Joggers'];
const MAX_RECENT_SEARCHES = 20;
const MAX_TRENDING_SEARCHES = 8;

/** Signed-in users get their recent searches synced across devices via `user_activity/{uid}`;
 *  guests fall back to a plain, unscoped localStorage list — same tradeoff as useCategoryHistory.
 *  On sign-in, whatever the guest searched locally is folded into the account's Firestore history
 *  (additive, deduped — see userActivityService.mergeGuestSearches) and local storage is cleared,
 *  same one-time-merge shape as useWishlist's guest-to-account merge. */
export function useSearch() {
  const { user, identityId, isAuthenticated } = useAuth();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 250);
  const [localSearches, setLocalSearches] = useLocalStorage<string[]>('dressmart:recent-searches', []);
  const [remoteSearches, setRemoteSearches] = useState<SearchHistoryEntry[] | null>(null);
  const hasMergedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setRemoteSearches(null);
      return;
    }
    let cancelled = false;
    userActivityService.get(identityId).then((activity) => {
      if (!cancelled) setRemoteSearches(activity.recent_searches);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, identityId]);

  useEffect(() => {
    if (!isAuthenticated || !user || hasMergedRef.current || localSearches.length === 0) return;
    hasMergedRef.current = true;
    userActivityService.mergeGuestSearches(user.id, localSearches).then(() => {
      setLocalSearches([]);
      return userActivityService.get(user.id).then((activity) => setRemoteSearches(activity.recent_searches));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user]);

  const recentSearches = isAuthenticated ? (remoteSearches ?? []).map((s) => s.query) : localSearches;

  const isQueryActive = debouncedQuery.trim().length > 1;

  const suggestionsQuery = useQuery({
    queryKey: ['search-suggestions', debouncedQuery],
    queryFn: async () => {
      const result = await productService.list({ search: debouncedQuery, pageSize: 8 });
      return result.items;
    },
    enabled: isQueryActive,
  });

  // Reuses the same cache keys as useCategories/useFeaturedBrands/useTrendingProducts, so no
  // duplicate network calls if those hooks are already mounted elsewhere on the page.
  const categoriesQuery = useQuery({ queryKey: queryKeys.categories.all, queryFn: () => categoryService.list() });
  const brandsQuery = useQuery({ queryKey: queryKeys.brands.all, queryFn: () => brandService.list() });
  const trendingProductsQuery = useQuery({ queryKey: ['products', 'trending'], queryFn: () => productService.getTrending() });

  const categorySuggestions = useMemo(() => {
    if (!isQueryActive || !categoriesQuery.data) return [];
    const q = debouncedQuery.trim().toLowerCase();
    return categoriesQuery.data.filter((c) => c.parent_id && c.name.toLowerCase().includes(q)).slice(0, 5);
  }, [categoriesQuery.data, debouncedQuery, isQueryActive]);

  const brandSuggestions = useMemo(() => {
    if (!isQueryActive || !brandsQuery.data) return [];
    const q = debouncedQuery.trim().toLowerCase();
    return brandsQuery.data.filter((b) => b.name.toLowerCase().includes(q)).slice(0, 5);
  }, [brandsQuery.data, debouncedQuery, isQueryActive]);

  /** Distinct from the static popular-searches list — derived from products actually marked trending right now. */
  const trendingSearches = useMemo(() => {
    if (!trendingProductsQuery.data) return [];
    const terms = new Set<string>();
    trendingProductsQuery.data.forEach((p) => {
      if (p.category?.name) terms.add(p.category.name);
    });
    return Array.from(terms).slice(0, MAX_TRENDING_SEARCHES);
  }, [trendingProductsQuery.data]);

  const commitSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    if (isAuthenticated) {
      const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ');
      const entry: SearchHistoryEntry = { query: trimmed, normalized_query: normalized, searched_at: new Date().toISOString(), result_count: 0 };
      setRemoteSearches((prev) => [entry, ...(prev ?? []).filter((s) => s.normalized_query !== normalized)].slice(0, MAX_RECENT_SEARCHES));
      // Firestore write happens here for every commit site (form submit, voice search, a recent/
      // trending/popular chip, a category or product suggestion click) — not all of those land on
      // /search, so this can't be deferred to SearchResultsPage alone. That page separately patches
      // in the real result_count once its own product query resolves (see updateSearchResultCount).
      void userActivityService.recordSearch(identityId, trimmed);
    } else {
      setLocalSearches((prev) => [trimmed, ...prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT_SEARCHES));
    }
  };

  const clearRecentSearches = () => {
    if (isAuthenticated) {
      setRemoteSearches([]);
      void userActivityService.clearRecentSearches(identityId);
    } else {
      setLocalSearches([]);
    }
  };

  const popularSearches = useMemo(() => POPULAR_SEARCHES, []);

  return {
    query,
    setQuery,
    suggestions: suggestionsQuery.data ?? [],
    isSearching: suggestionsQuery.isFetching,
    categorySuggestions,
    brandSuggestions,
    recentSearches,
    trendingSearches,
    popularSearches,
    commitSearch,
    clearRecentSearches,
  };
}
