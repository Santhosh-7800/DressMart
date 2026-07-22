import type { RatingSummary, Review, ReviewableOrderItem, SubmitReviewInput } from '@/types';
import { readStore, writeStore } from './mockStorage';
import { getOrders } from './mockUserData';

/** Genuinely empty until a real, verified-purchase review is submitted — no seeded/fake reviews. */
function allReviews(): Review[] {
  return readStore<Review[]>('reviews', []);
}

function saveAllReviews(reviews: Review[]): void {
  writeStore('reviews', reviews);
}

export function getReviewsForProduct(productId: string): Review[] {
  return allReviews()
    .filter((r) => r.product_id === productId)
    .sort((a, b) => b.helpful_count - a.helpful_count || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function summarize(productId: string, reviews: Review[]): RatingSummary {
  const forProduct = reviews.filter((r) => r.product_id === productId);
  const total = forProduct.length;
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  forProduct.forEach((r) => {
    counts[r.rating as 1 | 2 | 3 | 4 | 5] = (counts[r.rating as 1 | 2 | 3 | 4 | 5] ?? 0) + 1;
    sum += r.rating;
  });
  return {
    product_id: productId,
    average_rating: total > 0 ? Number((sum / total).toFixed(1)) : 0,
    total_reviews: total,
    rating_5: counts[5],
    rating_4: counts[4],
    rating_3: counts[3],
    rating_2: counts[2],
    rating_1: counts[1],
  };
}

export function getRatingSummary(productId: string): RatingSummary {
  return summarize(productId, allReviews());
}

export function getRatingSummaries(productIds: string[]): RatingSummary[] {
  const reviews = allReviews();
  return productIds.map((id) => summarize(id, reviews));
}

/** Delivered order items for this user+product that don't already have a review — the verified-purchase gate. */
export function getReviewableOrderItems(userId: string, productId: string): ReviewableOrderItem[] {
  const orders = getOrders(userId).filter((o) => o.status === 'delivered');
  const reviewedOrderItemIds = new Set(allReviews().map((r) => r.order_item_id));

  const reviewable: ReviewableOrderItem[] = [];
  orders.forEach((order) => {
    order.items
      .filter((item) => item.product_id === productId && !reviewedOrderItemIds.has(item.id))
      .forEach((item) => {
        reviewable.push({
          order_item_id: item.id,
          order_id: order.id,
          order_number: order.order_number,
          product_id: item.product_id,
          size: item.size,
          color: item.color,
          delivered_at: order.timeline.find((t) => t.status === 'delivered')?.timestamp ?? order.placed_at,
        });
      });
  });
  return reviewable;
}

export function submitReview(input: SubmitReviewInput, userName: string, userAvatar: string | null = null): Review {
  if (!input.user_id) {
    throw new Error('You must be signed in to write a review.');
  }
  const reviewable = getReviewableOrderItems(input.user_id, input.product_id);
  const match = reviewable.find((r) => r.order_item_id === input.order_item_id);
  if (!match) {
    throw new Error('Reviews can only be written for delivered orders, and only once per purchased item.');
  }

  const now = new Date().toISOString();
  const review: Review = {
    id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    product_id: input.product_id,
    user_id: input.user_id,
    order_id: input.order_id,
    order_item_id: input.order_item_id,
    user_name: userName,
    user_avatar: userAvatar,
    rating: input.rating,
    review_title: input.review_title?.trim() || null,
    review_text: input.review_text?.trim() || null,
    images: input.images ?? [],
    is_verified_purchase: true,
    helpful_count: 0,
    created_at: now,
    updated_at: now,
  };

  const reviews = allReviews();
  reviews.push(review);
  saveAllReviews(reviews);
  return review;
}
