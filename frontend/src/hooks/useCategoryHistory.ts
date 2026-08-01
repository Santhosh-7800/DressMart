import { useCallback, useEffect, useState } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { userActivityService } from '@/services/userActivityService';
import { useAuth } from '@/contexts/AuthContext';

const MAX_CATEGORY_HISTORY = 20;

/**
 * Tracks which category listing pages a shopper has browsed — a lighter-weight signal than
 * individual product views, used to personalize the homepage even before any product is opened.
 * Signed-in users get this synced across devices via `user_activity/{uid}`; guests fall back to a
 * plain localStorage list (previously this was localStorage for everyone, with no per-account
 * scoping at all — a signed-in user's history could leak into whoever else used that browser next).
 */
export function useCategoryHistory() {
  const { user, identityId, isAuthenticated } = useAuth();
  const [localSlugs, setLocalSlugs] = useLocalStorage<string[]>('dressmart:category-history', []);
  const [remoteSlugs, setRemoteSlugs] = useState<string[] | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setRemoteSlugs(null);
      return;
    }
    let cancelled = false;
    userActivityService.get(identityId).then((activity) => {
      if (!cancelled) setRemoteSlugs(activity.category_history);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, identityId, user?.id]);

  const recordCategoryView = useCallback(
    (categorySlug: string) => {
      if (isAuthenticated) {
        setRemoteSlugs((prev) => [categorySlug, ...(prev ?? []).filter((slug) => slug !== categorySlug)].slice(0, MAX_CATEGORY_HISTORY));
        void userActivityService.recordCategoryView(identityId, categorySlug);
      } else {
        setLocalSlugs((prev) => [categorySlug, ...prev.filter((slug) => slug !== categorySlug)].slice(0, MAX_CATEGORY_HISTORY));
      }
    },
    [isAuthenticated, identityId, setLocalSlugs],
  );

  return { categorySlugs: isAuthenticated ? (remoteSlugs ?? []) : localSlugs, recordCategoryView };
}
