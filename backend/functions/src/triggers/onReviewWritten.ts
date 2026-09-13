import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { db } from '../lib/admin';
import type { Review } from '../lib/types';

/**
 * Maintains `product_rating_summaries/{productId}` so a product page never has to fetch every
 * review just to show a star average (the gap reviewService.ts's own comment on the frontend left
 * as a known TODO). Recomputes from scratch on every write rather than incrementally patching
 * counts — a product's review count is small enough (tens to low hundreds) that a full re-read is
 * cheap, and it's the only approach that's automatically correct for edits (a rating changing from
 * 3 to 5) and moderation (a review being hidden/restored), not just creates/deletes.
 */
export const onReviewWritten = onDocumentWritten('reviews/{reviewId}', async (event) => {
  const before = event.data?.before.exists ? (event.data.before.data() as Review) : null;
  const after = event.data?.after.exists ? (event.data.after.data() as Review) : null;
  const productId = after?.product_id ?? before?.product_id;
  if (!productId) return;

  const reviewsSnap = await db.collection('reviews').where('product_id', '==', productId).get();
  const visibleReviews = reviewsSnap.docs.map((d) => d.data() as Review).filter((r) => !r.is_hidden);

  const summary = {
    product_id: productId,
    average_rating: 0,
    total_reviews: visibleReviews.length,
    rating_5: 0,
    rating_4: 0,
    rating_3: 0,
    rating_2: 0,
    rating_1: 0,
    updated_at: new Date().toISOString(),
  };
  if (visibleReviews.length > 0) {
    let total = 0;
    for (const review of visibleReviews) {
      total += review.rating;
      const bucket = Math.min(5, Math.max(1, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5;
      summary[`rating_${bucket}` as const] += 1;
    }
    summary.average_rating = Math.round((total / visibleReviews.length) * 10) / 10;
  }

  await db.collection('product_rating_summaries').doc(productId).set(summary);
});
