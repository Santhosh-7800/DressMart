import { env } from '@/lib/env';
import { recordProductView, getProductViews } from './mock/mockProductViews';

/**
 * Lightweight page-view instrumentation powering the Analytics "Product Views"/"Conversion Rate"
 * stats. Mock mode tracks real view counts in localStorage. This app has no view-tracking table in
 * Supabase (adding one is a bigger schema/RLS undertaking than this metric warrants for a first
 * cut) — live mode simply reports no view data yet rather than fabricating numbers.
 */
export const productViewService = {
  recordView(productId: string): void {
    if (env.useMockData) recordProductView(productId);
  },

  async getViewCounts(): Promise<Record<string, number>> {
    if (env.useMockData) return getProductViews();
    return {};
  },
};
