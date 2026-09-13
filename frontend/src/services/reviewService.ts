import { collection, doc, getDoc, getDocs, documentId, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import type { Order, RatingSummary, Review, ReviewableOrderItem, SubmitReviewInput } from '@/types';

const REVIEWS_COLLECTION = 'reviews';
const RATING_SUMMARIES_COLLECTION = 'product_rating_summaries';
const ORDERS_COLLECTION = 'orders';
const PRODUCTS_COLLECTION = 'products';

function emptySummary(productId: string): RatingSummary {
  return { product_id: productId, average_rating: 0, total_reviews: 0, rating_5: 0, rating_4: 0, rating_3: 0, rating_2: 0, rating_1: 0 };
}

export const reviewService = {
  /** Public reviews for a product, hidden (moderated) ones excluded — filtered client-side rather
   *  than via a query constraint since older review docs predate `is_hidden` and have no value for
   *  it at all, which a `where('is_hidden','==',false)` constraint would incorrectly exclude. */
  async listForProduct(productId: string): Promise<Review[]> {
    const snap = await getDocs(query(collection(db, REVIEWS_COLLECTION), where('product_id', '==', productId), orderBy('created_at', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Review).filter((r) => !r.is_hidden);
  },

  /** Reads the server-maintained summary (see backend/functions/src/triggers/onReviewWritten.ts) —
   *  no longer aggregates every review live on each call. Falls back to an empty summary for a
   *  product with zero reviews (the trigger never runs, so no doc exists yet). */
  async getRatingSummary(productId: string): Promise<RatingSummary> {
    const snap = await getDoc(doc(db, RATING_SUMMARIES_COLLECTION, productId));
    return snap.exists() ? (snap.data() as RatingSummary) : emptySummary(productId);
  },

  async getRatingSummaries(productIds: string[]): Promise<RatingSummary[]> {
    if (productIds.length === 0) return [];
    const chunks: string[][] = [];
    for (let i = 0; i < productIds.length; i += 30) chunks.push(productIds.slice(i, i + 30));

    const summaryById = new Map<string, RatingSummary>();
    for (const chunk of chunks) {
      const snap = await getDocs(query(collection(db, RATING_SUMMARIES_COLLECTION), where(documentId(), 'in', chunk)));
      snap.docs.forEach((d) => summaryById.set(d.id, d.data() as RatingSummary));
    }

    return productIds.map((id) => summaryById.get(id) ?? emptySummary(id));
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

  /**
   * Routes through the submitReview Cloud Function — see its docstring for why: order ownership/
   * delivery-status/duplicate-review checks all need server-side authority, which is also why
   * `userName`/`userAvatar` are no longer accepted here (the function reads the caller's own
   * profile for those, rather than trusting whatever the client passes).
   */
  async submit(input: SubmitReviewInput): Promise<{ reviewId: string }> {
    const call = httpsCallable<Omit<SubmitReviewInput, 'user_id'>, { success: true; reviewId: string }>(functions, 'submitReview');
    const { user_id: _user_id, ...payload } = input;
    const { data } = await call(payload);
    return { reviewId: data.reviewId };
  },

  /** Seller/head-seller reply to a review — overwrites any existing reply (edit = re-submit). */
  async replyToReview(reviewId: string, replyText: string): Promise<void> {
    await updateDoc(doc(db, REVIEWS_COLLECTION, reviewId), {
      seller_reply: { text: replyText, replied_at: new Date().toISOString() },
    });
  },

  /** Moderation (Phase 14) — hide/restore a review on the seller's own product. A plain client
   *  write, allowed by firestore.rules' dedicated is_hidden-only branch (same pattern as
   *  seller_reply above); no Cloud Function needed for a single boolean field flip. */
  async setHidden(reviewId: string, isHidden: boolean): Promise<void> {
    await updateDoc(doc(db, REVIEWS_COLLECTION, reviewId), { is_hidden: isHidden });
  },

  /** Lightweight dashboard stat — average rating + unreplied count across this seller's own
   *  products, without the product-name/slug join `listForSeller` does (that's for the full Reviews
   *  page; the dashboard only needs the two numbers). */
  async getSellerRatingOverview(sellerId: string): Promise<{ averageRating: number; totalReviews: number; unrepliedCount: number }> {
    const productsSnap = await getDocs(query(collection(db, PRODUCTS_COLLECTION), where('seller_id', '==', sellerId)));
    const ids = productsSnap.docs.map((d) => d.id);
    if (ids.length === 0) return { averageRating: 0, totalReviews: 0, unrepliedCount: 0 };

    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
    const results = await Promise.all(chunks.map((chunk) => getDocs(query(collection(db, REVIEWS_COLLECTION), where('product_id', 'in', chunk)))));
    const reviews = results.flatMap((snap) => snap.docs.map((d) => d.data() as Review));

    if (reviews.length === 0) return { averageRating: 0, totalReviews: 0, unrepliedCount: 0 };
    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const unrepliedCount = reviews.filter((r) => !r.seller_reply).length;
    return { averageRating: Math.round((totalRating / reviews.length) * 10) / 10, totalReviews: reviews.length, unrepliedCount };
  },

  /** Every review across this seller's own products, newest first — reviews are keyed by
   *  product_id, not seller_id, so this resolves the seller's product ids first. Powers
   *  SellerReviewsPage. */
  async listForSeller(sellerId: string): Promise<(Review & { product_name: string; product_slug: string })[]> {
    const productsSnap = await getDocs(query(collection(db, PRODUCTS_COLLECTION), where('seller_id', '==', sellerId)));
    const productsById = new Map(productsSnap.docs.map((d) => [d.id, d.data() as { name: string; slug: string }]));
    const ids = [...productsById.keys()];
    if (ids.length === 0) return [];

    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
    const results = await Promise.all(chunks.map((chunk) => getDocs(query(collection(db, REVIEWS_COLLECTION), where('product_id', 'in', chunk)))));

    return results
      .flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Review))
      .map((r) => ({ ...r, product_name: productsById.get(r.product_id)?.name ?? '', product_slug: productsById.get(r.product_id)?.slug ?? '' }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },
};
