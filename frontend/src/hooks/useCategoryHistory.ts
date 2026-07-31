import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

const MAX_CATEGORY_HISTORY = 20;

/** Tracks which category listing pages a shopper has browsed — a lighter-weight signal than
 *  individual product views, used to personalize the homepage even before any product is opened. */
export function useCategoryHistory() {
  const [categorySlugs, setCategorySlugs] = useLocalStorage<string[]>('dressmart:category-history', []);

  const recordCategoryView = useCallback(
    (categorySlug: string) => {
      setCategorySlugs((prev) => [categorySlug, ...prev.filter((slug) => slug !== categorySlug)].slice(0, MAX_CATEGORY_HISTORY));
    },
    [setCategorySlugs],
  );

  return { categorySlugs, recordCategoryView };
}
