import type { Product } from '@/types';
import { readStore, writeStore } from './mockStorage';

/**
 * The generated catalog (catalogGenerator.ts) is a deterministic, seeded, in-memory dataset —
 * it can't be mutated in place. Admin product writes (add/edit/delete/hide/publish/duplicate) are
 * layered on top of it here: `overrides` holds the full Product object for anything the admin has
 * added or edited (keyed by id — a brand-new id means a new product, an id that also exists in the
 * generated catalog means "this replaces that one"), and `deletedIds` hides generated products the
 * admin deleted. mockCatalogWithOverrides.ts does the actual merge at read time.
 */
const OVERRIDES_KEY = 'admin-product-overrides';
const DELETED_KEY = 'admin-deleted-product-ids';

export function getProductOverrides(): Record<string, Product> {
  return readStore<Record<string, Product>>(OVERRIDES_KEY, {});
}

export function getDeletedProductIds(): string[] {
  return readStore<string[]>(DELETED_KEY, []);
}

export function saveProductOverride(product: Product): void {
  const overrides = getProductOverrides();
  overrides[product.id] = product;
  writeStore(OVERRIDES_KEY, overrides);

  // Re-adding/editing a previously-deleted id (e.g. undo) should un-delete it.
  const deleted = getDeletedProductIds();
  if (deleted.includes(product.id)) {
    writeStore(
      DELETED_KEY,
      deleted.filter((id) => id !== product.id),
    );
  }
}

export function deleteProductOverride(productId: string): void {
  const overrides = getProductOverrides();
  delete overrides[productId];
  writeStore(OVERRIDES_KEY, overrides);

  const deleted = new Set(getDeletedProductIds());
  deleted.add(productId);
  writeStore(DELETED_KEY, [...deleted]);
}

export function bulkDeleteProducts(productIds: string[]): void {
  productIds.forEach(deleteProductOverride);
}
