/**
 * Lightweight page-view instrumentation. The admin Analytics dashboard that used to read
 * getViewCounts() is gone (see the deleted Admin module), so this is now just a fire-and-forget
 * localStorage tally — kept around only so ProductDetailsPage's recordView call has somewhere to
 * go; nothing currently reads getViewCounts. Not worth a Firestore collection for what's presently
 * a metric nothing displays.
 */
const STORAGE_KEY = 'dressmart:product-views';

function readCounts(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export const productViewService = {
  recordView(productId: string): void {
    try {
      const counts = readCounts();
      counts[productId] = (counts[productId] ?? 0) + 1;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
    } catch {
      // localStorage unavailable — fail silently, this is a non-critical metric.
    }
  },

  async getViewCounts(): Promise<Record<string, number>> {
    return readCounts();
  },
};
