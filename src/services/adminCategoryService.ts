import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { slugify } from '@/lib/utils';
import type { Category, Gender } from '@/types';
import { saveCategoryOverride, deleteCategoryOverride } from './mock/mockAdminCategories';
import { saveProductOverride, deleteProductOverride } from './mock/mockAdminProducts';
import { getCatalog } from './mock/mockCatalogWithOverrides';

export interface CategoryInput {
  id?: string;
  name: string;
  gender: Gender;
  sort_order: number;
}

export const adminCategoryService = {
  async save(input: CategoryInput): Promise<Category> {
    const parentId = input.gender === 'men' ? 'cat-men' : 'cat-kids';
    const existing = input.id ? getCatalog().categories.find((c) => c.id === input.id) : null;
    const id = input.id ?? crypto.randomUUID();
    const slug = existing?.slug ?? slugify(input.name);

    const category: Category = {
      id,
      name: input.name,
      slug,
      gender: input.gender,
      parent_id: parentId,
      image_url: existing?.image_url ?? null,
      sort_order: input.sort_order,
    };

    if (env.useMockData) {
      saveCategoryOverride(category);
      return category;
    }

    const { error } = await supabase.from('categories').upsert(category);
    if (error) throw new Error(error.message);
    return category;
  },

  /** How many products currently sit in this category — determines whether delete can proceed immediately or needs Move/Delete Anyway. */
  async getProductCount(categoryId: string): Promise<number> {
    if (env.useMockData) return getCatalog().products.filter((p) => p.category_id === categoryId).length;
    const { count, error } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('category_id', categoryId);
    if (error) throw new Error(error.message);
    return count ?? 0;
  },

  /** Only valid when the category has no products left — products.category_id is NOT NULL with ON DELETE RESTRICT in live mode, so this would fail otherwise. */
  async remove(categoryId: string): Promise<void> {
    if (env.useMockData) {
      deleteCategoryOverride(categoryId);
      return;
    }
    const { error } = await supabase.from('categories').delete().eq('id', categoryId);
    if (error) throw new Error(error.message);
  },

  /** Reassigns every product out of `fromCategoryId` into `toCategoryId`, then deletes the now-empty category. */
  async moveProductsAndDelete(fromCategoryId: string, toCategoryId: string): Promise<void> {
    if (env.useMockData) {
      const catalog = getCatalog();
      const targetCategory = catalog.categories.find((c) => c.id === toCategoryId);
      if (!targetCategory) throw new Error('Target category not found.');
      catalog.products
        .filter((p) => p.category_id === fromCategoryId)
        .forEach((p) => saveProductOverride({ ...p, category_id: toCategoryId, category: targetCategory }));
      deleteCategoryOverride(fromCategoryId);
      return;
    }
    const { error: updateError } = await supabase.from('products').update({ category_id: toCategoryId }).eq('category_id', fromCategoryId);
    if (updateError) throw new Error(updateError.message);
    const { error: deleteError } = await supabase.from('categories').delete().eq('id', fromCategoryId);
    if (deleteError) throw new Error(deleteError.message);
  },

  /** Admin-only override: deletes every product still in this category, then the category itself. */
  async forceDeleteWithProducts(categoryId: string): Promise<void> {
    if (env.useMockData) {
      getCatalog()
        .products.filter((p) => p.category_id === categoryId)
        .forEach((p) => deleteProductOverride(p.id));
      deleteCategoryOverride(categoryId);
      return;
    }
    const { error: deleteProductsError } = await supabase.from('products').delete().eq('category_id', categoryId);
    if (deleteProductsError) throw new Error(deleteProductsError.message);
    const { error: deleteCategoryError } = await supabase.from('categories').delete().eq('id', categoryId);
    if (deleteCategoryError) throw new Error(deleteCategoryError.message);
  },
};
