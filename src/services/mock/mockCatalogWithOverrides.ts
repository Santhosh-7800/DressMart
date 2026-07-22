import { buildCatalog, type Catalog } from '@/lib/catalogGenerator';
import { getProductOverrides, getDeletedProductIds } from './mockAdminProducts';
import { getCategoryOverrides, getDeletedCategoryIds } from './mockAdminCategories';

/**
 * Drop-in replacement for `buildCatalog()` that layers admin product/category overrides on top of
 * the generated catalog. Every mock catalog query already calls `buildCatalog()` fresh on each
 * invocation (relying on its own internal memoization for the expensive generation step) — importing
 * this function under the same local name is the only change needed for admin edits to "immediately
 * appear" everywhere in the customer app, with zero changes to any individual query function.
 */
export function getCatalog(): Catalog {
  const base = buildCatalog();
  const overrides = getProductOverrides();
  const deleted = new Set(getDeletedProductIds());
  const baseIds = new Set(base.products.map((p) => p.id));

  const products = base.products.filter((p) => !deleted.has(p.id)).map((p) => overrides[p.id] ?? p);
  const newProducts = Object.values(overrides).filter((p) => !baseIds.has(p.id) && !deleted.has(p.id));

  const categoryOverrides = getCategoryOverrides();
  const deletedCategories = new Set(getDeletedCategoryIds());
  const baseCategoryIds = new Set(base.categories.map((c) => c.id));
  const categories = base.categories.filter((c) => !deletedCategories.has(c.id)).map((c) => categoryOverrides[c.id] ?? c);
  const newCategories = Object.values(categoryOverrides).filter((c) => !baseCategoryIds.has(c.id) && !deletedCategories.has(c.id));

  return { ...base, categories: [...categories, ...newCategories], products: [...products, ...newProducts] };
}

/**
 * Customer-facing discovery (search/category/deals/bestsellers/...) excludes hidden products —
 * the mock-mode equivalent of the RLS policy "active products are publicly readable" that already
 * enforces this in live mode. Admin views, and resolving specific known ids (cart/wishlist/compare,
 * so a hidden product doesn't just vanish from a customer's existing cart), use getCatalog() instead.
 */
export function getActiveCatalog(): Catalog {
  const catalog = getCatalog();
  // Staff-submitted products additionally need approval_status === 'approved' — pending/rejected
  // stays hidden from the store no matter is_active. Undefined (every pre-Staff-Portal product,
  // and every admin-authored one) defaults to 'approved', so this never affects existing products.
  return { ...catalog, products: catalog.products.filter((p) => p.is_active && (p.approval_status ?? 'approved') === 'approved') };
}
