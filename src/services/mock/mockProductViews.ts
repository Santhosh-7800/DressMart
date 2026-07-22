import { readStore, writeStore } from './mockStorage';

const VIEWS_KEY = 'product-views';

export function recordProductView(productId: string): void {
  const views = readStore<Record<string, number>>(VIEWS_KEY, {});
  views[productId] = (views[productId] ?? 0) + 1;
  writeStore(VIEWS_KEY, views);
}

export function getProductViews(): Record<string, number> {
  return readStore<Record<string, number>>(VIEWS_KEY, {});
}
