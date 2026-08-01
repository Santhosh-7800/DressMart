/**
 * Lightweight page-view instrumentation — a fire-and-forget localStorage tally, kept around only
 * so ProductDetailsPage's recordView call has somewhere to go. Not worth a Firestore collection
 * for what's presently a metric nothing displays.
 */
const STORAGE_KEY = 'dressmart:product-views';

export const productViewService = {
  recordView(productId: string): void {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const counts = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      counts[productId] = (counts[productId] ?? 0) + 1;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
    } catch {
      // localStorage unavailable — fail silently, this is a non-critical metric.
    }
  },
};
