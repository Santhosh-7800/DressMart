import { addDoc, collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, RatingSummary, Review, ReviewableOrderItem, SubmitReviewInput } from '@/types';

const REVIEWS_COLLECTION = 'reviews';
const ORDERS_COLLECTION = 'orders';

/**
 * Rating aggregation: Firestore has no SQL views/materialized aggregates, and buyers aren't allowed
 * to write to `products/{id}` (see firestore.rules — only the owning seller / head_seller can), so
 * `product.rating`/`product.rating_count` CANNOT be denormalized safely from this client-side
 * service. Everything here is computed live by fetching + aggregating this product's `reviews` docs
 * on every call. If `product.rating`/`rating_count` need to stay in sync for catalog sort/filter,
 * that has to happen server-side — e.g. a Cloud Function `onCreate`/`onDelete` trigger on
 * `reviews/{id}` that updates the parent product with the Admin SDK. Flagging this as a gap for
 * whoever owns functions/.
 */
function emptySummary(productId: string): RatingSummary {
  return { product_id: productId, average_rating: 0, total_reviews: 0, rating_5: 0, rating_4: 0, rating_3: 0, rating_2: 0, rating_1: 0 };
}

function summarize(productId: string, reviews: Review[]): RatingSummary {
  if (reviews.length === 0) return emptySummary(productId);
  const summary = emptySummary(productId);
  let total = 0;
  for (const review of reviews) {
    total += review.rating;
    const bucket = Math.min(5, Math.max(1, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5;
    summary[`rating_${bucket}` as const] += 1;
  }
  summary.total_reviews = reviews.length;
  summary.average_rating = Math.round((total / reviews.length) * 10) / 10;
  return summary;
}

export const reviewService = {
  async listForProduct(productId: string): Promise<Review[]> {
    const snap = await getDocs(query(collection(db, REVIEWS_COLLECTION), where('product_id', '==', productId), orderBy('created_at', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Review);
  },

  /** Always computed live — see the module-level comment on why this isn't a stored field. */
  async getRatingSummary(productId: string): Promise<RatingSummary> {
    const reviews = await this.listForProduct(productId);
    return summarize(productId, reviews);
  },

  async getRatingSummaries(productIds: string[]): Promise<RatingSummary[]> {
    if (productIds.length === 0) return [];
    // Firestore 'in' queries cap at 30 values — chunk defensively for larger product lists.
    const chunks: string[][] = [];
    for (let i = 0; i < productIds.length; i += 30) chunks.push(productIds.slice(i, i + 30));

    const reviewsByProduct = new Map<string, Review[]>();
    for (const chunk of chunks) {
      const snap = await getDocs(query(collection(db, REVIEWS_COLLECTION), where('product_id', 'in', chunk)));
      snap.docs.forEach((d) => {
        const review = { id: d.id, ...d.data() } as Review;
        const list = reviewsByProduct.get(review.product_id) ?? [];
        list.push(review);
        reviewsByProduct.set(review.product_id, list);
      });
    }

    return productIds.map((id) => summarize(id, reviewsByProduct.get(id) ?? []));
  },

  /** Delivered, not-yet-reviewed order items for this user+product — gates the "Write a Review" UI. */
  async getReviewableOrderItems(userId: string, productId: string): Promise<ReviewableOrderItem[]> {
    const [ordersSnap, reviewedSnap] = await Promise.all([
      getDocs(query(collection(db, ORDERS_COLLECTION), where('buyer_id', '==', userId))),
      getDocs(query(collection(db, REVIEWS_COLLECTION), where('user_id', '==', userId), where('product_id', '==', productId))),
    ]);

    const alreadyReviewedItemIds = new Set(reviewedSnap.docs.map((d) => d.data().order_item_id as string));

    const reviewable: ReviewableOrderItem[] = [];
    ordersSnap.docs.forEach((d) => {
      const order = { id: d.id, ...d.data() } as Order;
      if (order.status !== 'delivered') return;
      const deliveredEvent = order.timeline?.find((t) => t.status === 'delivered');
      order.items
        .filter((item) => item.product_id === productId && !alreadyReviewedItemIds.has(item.id))
        .forEach((item) => {
          reviewable.push({
            order_item_id: item.id,
            order_id: order.id,
            order_number: order.order_number,
            product_id: item.product_id,
            size: item.size,
            color: item.color,
            delivered_at: deliveredEvent?.timestamp ?? order.placed_at,
          });
        });
    });
    return reviewable;
  },

  async submit(input: SubmitReviewInput, userName: string, userAvatar: string | null): Promise<Review> {
    const now = new Date().toISOString();
    const payload = {
      product_id: input.product_id,
      user_id: input.user_id,
      order_id: input.order_id,
      order_item_id: input.order_item_id,
      user_name: userName,
      user_avatar: userAvatar,
      rating: input.rating,
      review_title: input.review_title ?? null,
      review_text: input.review_text ?? null,
      images: input.images ?? [],
      is_verified_purchase: true,
      helpful_count: 0,
      created_at: now,
      updated_at: now,
    };
    const ref = await addDoc(collection(db, REVIEWS_COLLECTION), payload);
    return { id: ref.id, ...payload };
  },
};
