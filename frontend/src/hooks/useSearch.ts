import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from './useDebounce';
import { useLocalStorage } from './useLocalStorage';
import { productService, categoryService, brandService } from '@/services/productService';
import { userActivityService } from '@/services/userActivityService';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';

const POPULAR_SEARCHES = ['Formal Shirts', 'Jeans', 'Hoodies', 'Kids T-Shirts', 'Jackets', 'Polo T-Shirts', 'Joggers'];
const MAX_RECENT_SEARCHES = 8;
const MAX_TRENDING_SEARCHES = 8;

/** Signed-in users get their recent searches synced across devices via `user_activity/{uid}`;
 *  guests fall back to a plain, unscoped localStorage list — same tradeoff as useCategoryHistory. */
export function useSearch() {
  const { identityId, isAuthenticated } = useAuth();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 250);
  const [localSearches, setLocalSearches] = useLocalStorage<string[]>('dressmart:recent-searches', []);
  const [remoteSearches, setRemoteSearches] = useState<string[] | null>(null);

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

  const recentSearches = isAuthenticated ? (remoteSearches ?? []) : localSearches;

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
      setRemoteSearches((prev) => [trimmed, ...(prev ?? []).filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT_SEARCHES));
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
