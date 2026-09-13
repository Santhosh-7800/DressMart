import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from '../lib/admin';
import { runCallable } from '../lib/callableGuard';
import type { Order, Profile, Review } from '../lib/types';

interface SubmitReviewData {
  product_id: string;
  order_id: string;
  order_item_id: string;
  rating: number;
  review_title?: string;
  review_text?: string;
  images?: string[];
}

const MAX_TITLE_LENGTH = 100;
const MAX_TEXT_LENGTH = 1000;
const MAX_IMAGES = 5;

/**
 * Server-authoritative review submission — Phase 14's audit found the previous client-side write
 * (a plain `addDoc` gated only by firestore.rules' `user_id == uid()` check) let ANY signed-in
 * account create a review for ANY product with `is_verified_purchase: true` hardcoded, no order
 * ever checked, and no duplicate-review guard. firestore.rules now sets `reviews` create to
 * `allow create: if false` — this callable is the only path a review can be created through.
 *
 * Validates, in order: rating range, content length/count limits, that the referenced order
 * actually belongs to this user and is delivered, that the order actually contains this exact
 * item/product, and that this order item hasn't already been reviewed — then writes the review
 * with `is_verified_purchase: true`, which is trustworthy here specifically because every other
 * check just passed.
 */
export const submitReview = onCall<SubmitReviewData>(async (request) =>
  runCallable('Could not submit your review. Please try again.', async () => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in to write a review.');
    }
    const { product_id, order_id, order_item_id, rating, review_title, review_text, images } = request.data ?? ({} as SubmitReviewData);

    if (!product_id || typeof product_id !== 'string' || !order_id || typeof order_id !== 'string' || !order_item_id || typeof order_item_id !== 'string') {
      throw new HttpsError('invalid-argument', 'product_id, order_id, and order_item_id are required.');
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new HttpsError('invalid-argument', 'rating must be a whole number from 1 to 5.');
    }
    if (review_title != null && (typeof review_title !== 'string' || review_title.length > MAX_TITLE_LENGTH)) {
      throw new HttpsError('invalid-argument', `review_title must be ${MAX_TITLE_LENGTH} characters or fewer.`);
    }
    if (review_text != null && (typeof review_text !== 'string' || review_text.length > MAX_TEXT_LENGTH)) {
      throw new HttpsError('invalid-argument', `review_text must be ${MAX_TEXT_LENGTH} characters or fewer.`);
    }
    if (images != null && (!Array.isArray(images) || images.length > MAX_IMAGES || images.some((i) => typeof i !== 'string'))) {
      throw new HttpsError('invalid-argument', `At most ${MAX_IMAGES} review images are allowed.`);
    }

    const uid = request.auth.uid;

    const [callerSnap, orderSnap] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('orders').doc(order_id).get(),
    ]);
    const caller = callerSnap.data() as Profile | undefined;
    if (!caller) {
      throw new HttpsError('permission-denied', 'Account not found.');
    }
    if (!orderSnap.exists) {
      throw new HttpsError('not-found', 'Order not found.');
    }
    const order = orderSnap.data() as Order;
    if (order.buyer_id !== uid) {
      throw new HttpsError('permission-denied', 'This order does not belong to you.');
    }
    if (order.status !== 'delivered') {
      throw new HttpsError('failed-precondition', 'You can only review products from delivered orders.');
    }
    const item = order.items.find((i) => i.id === order_item_id);
    if (!item || item.product_id !== product_id) {
      throw new HttpsError('failed-precondition', 'This item was not found in the specified order.');
    }

    const existingReview = await db
      .collection('reviews')
      .where('order_item_id', '==', order_item_id)
      .where('user_id', '==', uid)
      .limit(1)
      .get();
    if (!existingReview.empty) {
      throw new HttpsError('already-exists', "You've already reviewed this item.");
    }

    const now = new Date().toISOString();
    const review: Omit<Review, 'id'> = {
      product_id,
      user_id: uid,
      order_id,
      order_item_id,
      user_name: caller.full_name,
      user_avatar: caller.avatar_url,
      rating,
      review_title: review_title?.trim() || null,
      review_text: review_text?.trim() || null,
      images: images ?? [],
      is_verified_purchase: true,
      helpful_count: 0,
      created_at: now,
      updated_at: now,
    };
    const ref = await db.collection('reviews').add(review);

    return { success: true, reviewId: ref.id };
  }),
);
