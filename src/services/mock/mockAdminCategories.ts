import type { Category } from '@/types';
import { readStore, writeStore } from './mockStorage';

/** Same override-layer pattern as mockAdminProducts.ts, applied to categories. */
const OVERRIDES_KEY = 'admin-category-overrides';
const DELETED_KEY = 'admin-deleted-category-ids';

export function getCategoryOverrides(): Record<string, Category> {
  return readStore<Record<string, Category>>(OVERRIDES_KEY, {});
}

export function getDeletedCategoryIds(): string[] {
  return readStore<string[]>(DELETED_KEY, []);
}

export function saveCategoryOverride(category: Category): void {
  const overrides = getCategoryOverrides();
  overrides[category.id] = category;
  writeStore(OVERRIDES_KEY, overrides);

  const deleted = getDeletedCategoryIds();
  if (deleted.includes(category.id)) {
    writeStore(
      DELETED_KEY,
      deleted.filter((id) => id !== category.id),
    );
  }
}

export function deleteCategoryOverride(categoryId: string): void {
  const overrides = getCategoryOverrides();
  delete overrides[categoryId];
  writeStore(OVERRIDES_KEY, overrides);

  const deleted = new Set(getDeletedCategoryIds());
  deleted.add(categoryId);
  writeStore(DELETED_KEY, [...deleted]);
}
